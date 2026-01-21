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
      async ({ data, req, operation }) => {
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

        // Store file buffer in request for afterChange hook (works in serverless)
        // This captures the file data before it's saved to disk
        if (operation === 'create') {
          try {
            // Try different ways to access file data depending on Payload version
            const fileData = 
              (req as any).file?.data || 
              (req as any).files?.file?.data ||
              (req as any).file?.buffer ||
              (req as any).files?.file?.buffer

            if (fileData) {
              // Store buffer for afterChange hook
              ;(req as any).fileBufferForCloudinary = Buffer.isBuffer(fileData) 
                ? fileData 
                : Buffer.from(fileData)
            }
          } catch (error) {
            // Silently fail - we'll try filesystem in afterChange as fallback
            console.warn('Could not capture file buffer in beforeChange:', error)
          }
        }

        return data
      },
    ],
    afterRead: [
      ({ doc }) => {
        // Priority 1: Always use publicUrl (Cloudinary) if it's a Cloudinary URL
        if (doc.publicUrl && typeof doc.publicUrl === 'string' && doc.publicUrl.includes('cloudinary.com')) {
          doc.url = doc.publicUrl
          return doc
        }
        
        // Priority 2: Generate Cloudinary URL from public_id if available
        if (doc.cloudinaryPublicId) {
          const cloudinaryUrl = cloudinary.url(doc.cloudinaryPublicId as string, {
            secure: true,
          })
          doc.url = cloudinaryUrl
          // Also set publicUrl if it's missing or not a Cloudinary URL
          if (!doc.publicUrl || !doc.publicUrl.includes('cloudinary.com')) {
            doc.publicUrl = cloudinaryUrl
          }
          return doc
        }
        
        // Priority 3: Replace localhost URLs (even if Cloudinary data is missing)
        // This handles cases where Cloudinary upload hasn't completed yet or failed
        if (doc.url && typeof doc.url === 'string') {
          const isLocalhost = 
            doc.url.includes('localhost') || 
            doc.url.includes('127.0.0.1') ||
            doc.url.startsWith('http://localhost') ||
            doc.url.startsWith('https://localhost')
          
          if (isLocalhost) {
            // If we have cloudinaryPublicId, generate Cloudinary URL
            if (doc.cloudinaryPublicId) {
              const cloudinaryUrl = cloudinary.url(doc.cloudinaryPublicId as string, {
                secure: true,
              })
              doc.url = cloudinaryUrl
              doc.publicUrl = cloudinaryUrl
              return doc
            }
            
            // Log warning in production - Cloudinary upload may have failed
            if (process.env.NODE_ENV === 'production') {
              console.warn(
                `⚠️  Media ${doc.id} has localhost URL but no Cloudinary data. ` +
                `URL: ${doc.url}. Filename: ${doc.filename}. ` +
                `This image may need to be re-uploaded or Cloudinary upload may have failed.`
              )
            }
          }
        }
        
        return doc
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        // Use a flag to prevent infinite recursion when updating
        const isUpdatingCloudinary = (req as unknown as Record<string, unknown>).isUpdatingCloudinary
        if (isUpdatingCloudinary) {
          return doc
        }

        // Upload to Cloudinary after file is created
        if (operation === 'create' && doc.filename && !doc.cloudinaryPublicId) {
          try {
            let fileBuffer: Buffer | null = null

            // Method 1: Use file buffer captured in beforeChange hook (works in serverless)
            if ((req as any).fileBufferForCloudinary) {
              fileBuffer = (req as any).fileBufferForCloudinary
              console.log('✓ Using file buffer from request (serverless-friendly)')
            }
            // Method 2: Try to get file data directly from request (fallback)
            else {
              const fileData = 
                (req as any).file?.data || 
                (req as any).files?.file?.data ||
                (req as any).file?.buffer ||
                (req as any).files?.file?.buffer

              if (fileData) {
                fileBuffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData)
                console.log('✓ Using file data from request object')
              }
            }

            // Method 3: Try filesystem as last resort (works in local dev, may fail in serverless)
            if (!fileBuffer) {
              try {
                const possiblePaths = [
                  path.resolve(process.cwd(), 'media', doc.filename as string),
                  path.resolve(process.cwd(), 'public', 'media', doc.filename as string),
                  path.resolve(process.cwd(), doc.filename as string),
                  doc.url && typeof doc.url === 'string' && doc.url.startsWith('/') 
                    ? path.resolve(process.cwd(), 'public', doc.url)
                    : null,
                ].filter(Boolean) as string[]

                for (const filePath of possiblePaths) {
                  try {
                    if (existsSync(filePath)) {
                      fileBuffer = readFileSync(filePath)
                      console.log('✓ Using file from filesystem:', filePath)
                      break
                    }
                  } catch (_fsError) {
                    // Continue to next path
                    continue
                  }
                }
              } catch (_fsError) {
                // Filesystem access failed (expected in serverless) - continue to URL fallback
                console.warn('Filesystem access not available (normal in serverless)')
              }
            }

            // If we have a file buffer, upload to Cloudinary
            if (fileBuffer) {
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
                  url: uploadResult.secure_url,
                },
              })
              console.log('✓ Uploaded to Cloudinary:', uploadResult.secure_url)
              delete (req as unknown as Record<string, unknown>).isUpdatingCloudinary
              delete (req as any).fileBufferForCloudinary
            } 
            // Fallback: If URL is already a Cloudinary URL, extract metadata
            else if (doc.url && typeof doc.url === 'string' && doc.url.includes('cloudinary.com')) {
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
                console.log('✓ Extracted Cloudinary metadata from existing URL')
                delete (req as unknown as Record<string, unknown>).isUpdatingCloudinary
              }
            } 
            // Last resort: Log warning but don't fail the request
            else {
              console.warn('⚠️  Could not access file for Cloudinary upload:', doc.filename)
              console.warn('   File URL:', doc.url)
              console.warn('   This may happen in serverless environments.')
              console.warn('   The file was saved, but Cloudinary upload will need to be done manually.')
            }
          } catch (error) {
            // Don't fail the request if Cloudinary upload fails
            console.error('❌ Error uploading to Cloudinary:', error)
            console.error('   File was still saved to database:', doc.id)
          } finally {
            // Clean up
            delete (req as unknown as Record<string, unknown>).isUpdatingCloudinary
            delete (req as any).fileBufferForCloudinary
          }
        }

        // Ensure publicUrl and url are always set to Cloudinary URLs if available
        if (doc.cloudinaryPublicId) {
          const cloudinaryUrl = cloudinary.url(doc.cloudinaryPublicId as string, {
            secure: true,
          })
          
          // Always use Cloudinary URL if we have publicId
          return {
            ...doc,
            publicUrl: cloudinaryUrl,
            url: cloudinaryUrl,
          }
        }
        
        // If publicUrl exists and is a Cloudinary URL, ensure url matches
        if (doc.publicUrl && typeof doc.publicUrl === 'string' && doc.publicUrl.includes('cloudinary.com')) {
          doc.url = doc.publicUrl
        }
        
        // Replace any localhost URLs with Cloudinary URLs if we have Cloudinary data
        if (doc.url && typeof doc.url === 'string' && 
            (doc.url.includes('localhost') || doc.url.includes('127.0.0.1'))) {
          if (doc.publicUrl && typeof doc.publicUrl === 'string' && doc.publicUrl.includes('cloudinary.com')) {
            doc.url = doc.publicUrl
          } else if (doc.cloudinaryPublicId) {
            const cloudinaryUrl = cloudinary.url(doc.cloudinaryPublicId as string, {
              secure: true,
            })
            doc.url = cloudinaryUrl
            doc.publicUrl = cloudinaryUrl
          }
        }

        return doc
      },
    ],
    afterDelete: [
      async ({ doc }) => {
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
