import { v2 as cloudinary } from 'cloudinary'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { CollectionConfig } from 'payload'
import { Readable } from 'stream'

// Configure Cloudinary
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
}

if (cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && cloudinaryConfig.api_secret) {
  cloudinary.config(cloudinaryConfig)
}

// Helper function to upload file buffer to Cloudinary
async function uploadToCloudinary(
  fileBuffer: Buffer,
  filename: string,
  folder: string = 'ceyara-tours'
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error)
        } else if (result) {
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          })
        } else {
          reject(new Error('Upload failed: No result'))
        }
      }
    )

    Readable.from(fileBuffer).pipe(uploadStream)
  })
}

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: () => true, // Allow public uploads for registration
    update: ({ req: { user } }) => {
      return !!user // Allow authenticated users to update
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'admin' || user?.role === 'editor' // Only admins/editors can delete
    },
  },
  admin: {
    useAsTitle: 'alt',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: false,
      admin: {
        description: 'Alt text for the image (auto-generated from filename if not provided)',
      },
    },
    {
      name: 'publicUrl',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Public URL of the image stored in Cloudinary',
      },
    },
    {
      name: 'cloudinaryPublicId',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Cloudinary public ID for the image',
      },
    },
  ],
  upload: {
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 768,
        height: 1024,
        position: 'centre',
      },
      {
        name: 'tablet',
        width: 1024,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*'],
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Auto-generate alt text from filename if not provided
        if (!data.alt || (typeof data.alt === 'string' && data.alt.trim() === '')) {
          const filename = data.filename || data.url
          if (filename && typeof filename === 'string') {
            // Extract filename without extension and format it
            const nameWithoutExt =
              filename
                .split('/')
                .pop()
                ?.replace(/\.[^/.]+$/, '')
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase()) || 'Image'
            data.alt = nameWithoutExt
          } else {
            data.alt = 'Image'
          }
        }

        return data
      },
    ],
    afterRead: [
      ({ doc }) => {
        // Ensure url is always set from publicUrl (Cloudinary) if available
        // This ensures images display correctly in production
        if (doc.publicUrl) {
          doc.url = doc.publicUrl
        } else if (doc.cloudinaryPublicId) {
          // Generate Cloudinary URL from public_id if publicUrl is missing
          const cloudinaryUrl = cloudinary.url(doc.cloudinaryPublicId as string, {
            secure: true,
          })
          doc.url = cloudinaryUrl
          doc.publicUrl = cloudinaryUrl
        }
        return doc
      },
    ],
    afterChange: [
      async ({ doc, req, operation, previousDoc }) => {
        // Use a flag to prevent infinite recursion when updating
        const isUpdatingCloudinary = (req as unknown as Record<string, unknown>).isUpdatingCloudinary
        if (isUpdatingCloudinary) {
          return doc
        }

        // Upload to Cloudinary after file is created
        if (operation === 'create' && doc.filename && !doc.cloudinaryPublicId) {
          try {
            // Payload stores files in the media directory when using local storage
            // Check multiple possible locations
            const possiblePaths = [
              path.resolve(process.cwd(), 'media', doc.filename as string),
              path.resolve(process.cwd(), 'public', 'media', doc.filename as string),
              path.resolve(process.cwd(), doc.filename as string),
              doc.url && typeof doc.url === 'string' && doc.url.startsWith('/') 
                ? path.resolve(process.cwd(), 'public', doc.url)
                : null,
            ].filter(Boolean) as string[]

            let fileBuffer: Buffer | null = null
            let foundPath: string | null = null

            // Try to find and read the file
            for (const filePath of possiblePaths) {
              if (existsSync(filePath)) {
                fileBuffer = readFileSync(filePath)
                foundPath = filePath
                break
              }
            }

            // If file found, upload to Cloudinary
            if (fileBuffer && foundPath) {
              const uploadResult = await uploadToCloudinary(
                fileBuffer,
                doc.filename as string,
                'ceyara-tours'
              )

              // Update document with Cloudinary URLs
              ;(req as unknown as Record<string, unknown>).isUpdatingCloudinary = true
              await req.payload.update({
                collection: 'media',
                id: doc.id,
                data: {
                  publicUrl: uploadResult.secure_url,
                  cloudinaryPublicId: uploadResult.public_id,
                  url: uploadResult.secure_url, // Update main URL
                },
              })
              console.log('✓ Uploaded to Cloudinary:', uploadResult.secure_url)
              delete (req as unknown as Record<string, unknown>).isUpdatingCloudinary

              // Optionally delete local file after upload (uncomment if desired)
              // try {
              //   if (existsSync(foundPath)) {
              //     unlinkSync(foundPath)
              //   }
              // } catch (error) {
              //   console.warn('Could not delete local file:', error)
              // }
            } else if (doc.url && typeof doc.url === 'string') {
              // If file doesn't exist locally but URL is already a Cloudinary URL
              if (doc.url.includes('cloudinary.com')) {
                // Extract public_id from Cloudinary URL
                const urlMatch = doc.url.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/)
                if (urlMatch && urlMatch[1]) {
                  const publicId = urlMatch[1]
                  ;(req as unknown as Record<string, unknown>).isUpdatingCloudinary = true
                  await req.payload.update({
                    collection: 'media',
                    id: doc.id,
                    data: {
                      publicUrl: doc.url,
                      cloudinaryPublicId: publicId,
                    },
                  })
                  delete (req as unknown as Record<string, unknown>).isUpdatingCloudinary
                }
              } else {
                // If URL is a local URL, try to upload it
                console.warn('File not found locally, but URL exists:', doc.url)
                console.warn('You may need to upload this file manually to Cloudinary')
              }
            }
          } catch (error) {
            console.error('Error uploading to Cloudinary:', error)
            delete (req as unknown as Record<string, unknown>).isUpdatingCloudinary
          }
        }

        // Ensure publicUrl is set from Cloudinary if available
        if (doc.cloudinaryPublicId && !doc.publicUrl) {
          const cloudinaryUrl = cloudinary.url(doc.cloudinaryPublicId as string, {
            secure: true,
          })
          return {
            ...doc,
            publicUrl: cloudinaryUrl,
            url: cloudinaryUrl,
          }
        }

        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        // Handle delete - remove from Cloudinary
        if (doc?.cloudinaryPublicId) {
          try {
            await cloudinary.uploader.destroy(doc.cloudinaryPublicId as string)
            console.log('✓ Deleted from Cloudinary:', doc.cloudinaryPublicId)
          } catch (error) {
            console.error('Error deleting from Cloudinary:', error)
          }
        }
      },
    ],
  },
}
