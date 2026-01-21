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

const isCloudinaryConfigured = !!(
  cloudinaryConfig.cloud_name && 
  cloudinaryConfig.api_key && 
  cloudinaryConfig.api_secret
)

if (isCloudinaryConfigured) {
  cloudinary.config(cloudinaryConfig)
}

// Helper function to upload file buffer to Cloudinary with retry logic
async function uploadToCloudinary(
  fileBuffer: Buffer,
  filename: string,
  folder: string = 'ceyara-tours',
  retries: number = 2
): Promise<{ secure_url: string; public_id: string }> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'auto',
            transformation: [
              { quality: 'auto' },
              { fetch_format: 'auto' },
            ],
            timeout: 60000, // 60 second timeout
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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000 // Exponential backoff: 1s, 2s, 4s
        console.warn(`⚠️  Cloudinary upload attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('Upload failed after retries')
}

// Helper function to fetch file from URL
async function fetchFileFromUrl(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Ceyara-Tours-CMS/1.0',
      },
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.warn(`⚠️  Failed to fetch file from URL: ${response.status} ${response.statusText}`)
      return null
    }
    
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('⚠️  Timeout fetching file from URL')
    } else {
      console.warn('⚠️  Error fetching file from URL:', error)
    }
    return null
  }
}

// Helper function to extract file buffer from request (multiple methods for compatibility)
function extractFileBufferFromRequest(req: any): Buffer | null {
  // Method 1: Pre-captured buffer from beforeChange hook
  if (req.fileBufferForCloudinary && Buffer.isBuffer(req.fileBufferForCloudinary)) {
    return req.fileBufferForCloudinary
  }
  
  // Method 2: Direct file data from request
  const fileData = 
    req.file?.data || 
    req.files?.file?.data ||
    req.file?.buffer ||
    req.files?.file?.buffer ||
    req.file?.stream?.read() ||
    req.files?.file?.stream?.read()
  
  if (fileData) {
    if (Buffer.isBuffer(fileData)) {
      return fileData
    }
    if (typeof fileData === 'string') {
      return Buffer.from(fileData, 'base64')
    }
    try {
      return Buffer.from(fileData)
    } catch {
      return null
    }
  }
  
  return null
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
        if (operation === 'create' && isCloudinaryConfigured) {
          try {
            // Try to extract file buffer using helper function
            const fileBuffer = extractFileBufferFromRequest(req)
            
            if (fileBuffer && fileBuffer.length > 0) {
              // Store buffer for afterChange hook
              ;(req as any).fileBufferForCloudinary = fileBuffer
              if (process.env.NODE_ENV !== 'production') {
                console.log(`✓ Captured file buffer in beforeChange (${fileBuffer.length} bytes)`)
              }
            }
          } catch (error) {
            // Silently fail - we'll try other methods in afterChange as fallback
            if (process.env.NODE_ENV !== 'production') {
              console.warn('Could not capture file buffer in beforeChange:', error)
            }
          }
        }

        return data
      },
    ],
    afterRead: [
      ({ doc }) => {
        // Priority 1: Always use publicUrl (Cloudinary) if it's a Cloudinary URL
        if (doc.publicUrl && typeof doc.publicUrl === 'string' && doc.publicUrl.includes('cloudinary.com')) {
          return {
            ...doc,
            url: doc.publicUrl,
          }
        }
        
        // Priority 2: Generate Cloudinary URL from public_id if available
        if (doc.cloudinaryPublicId && isCloudinaryConfigured) {
          const cloudinaryUrl = cloudinary.url(doc.cloudinaryPublicId as string, {
            secure: true,
          })
          
          // Also set publicUrl if it's missing or not a Cloudinary URL
          const updatedPublicUrl = (!doc.publicUrl || !doc.publicUrl.includes('cloudinary.com')) 
            ? cloudinaryUrl 
            : doc.publicUrl
          
          return {
            ...doc,
            url: cloudinaryUrl,
            publicUrl: updatedPublicUrl,
          }
        }
        
        // Priority 3: Replace localhost/Vercel URLs with Cloudinary URLs if available
        // This handles cases where Cloudinary upload hasn't completed yet or failed
        if (doc.url && typeof doc.url === 'string') {
          const isLocalOrVercel = 
            doc.url.includes('localhost') || 
            doc.url.includes('127.0.0.1') ||
            doc.url.includes('vercel.app') ||
            doc.url.includes('vercel.com') ||
            doc.url.startsWith('http://localhost') ||
            doc.url.startsWith('https://localhost')
          
          if (isLocalOrVercel) {
            // If we have cloudinaryPublicId, generate Cloudinary URL
            if (doc.cloudinaryPublicId && isCloudinaryConfigured) {
              const cloudinaryUrl = cloudinary.url(doc.cloudinaryPublicId as string, {
                secure: true,
              })
              return {
                ...doc,
                url: cloudinaryUrl,
                publicUrl: cloudinaryUrl,
              }
            }
            
            // Log warning in production - Cloudinary upload may have failed
            if (process.env.NODE_ENV === 'production' && isCloudinaryConfigured) {
              console.warn(
                `⚠️  Media ${doc.id} has ${isLocalOrVercel ? 'local/Vercel' : 'localhost'} URL but no Cloudinary data. ` +
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

        // Check Cloudinary configuration first
        if (!isCloudinaryConfigured) {
          if (process.env.NODE_ENV === 'production') {
            console.warn('⚠️  Cloudinary not configured. Images will use local URLs.')
          }
          return doc
        }

        // Upload to Cloudinary after file is created
        if (operation === 'create' && doc.filename && !doc.cloudinaryPublicId) {
          try {
            let fileBuffer: Buffer | null = null
            const uploadSource: string[] = []

            // Method 1: Extract from request object (works in serverless)
            fileBuffer = extractFileBufferFromRequest(req)
            if (fileBuffer) {
              uploadSource.push('request object')
            }

            // Method 2: Try filesystem (works in local dev, may fail in serverless)
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
                      uploadSource.push(`filesystem: ${filePath}`)
                      break
                    }
                  } catch {
                    continue
                  }
                }
              } catch {
                // Filesystem access failed (expected in serverless)
              }
            }

            // Method 3: Fetch from URL (works in serverless - fetches from Vercel/CDN)
            if (!fileBuffer && doc.url && typeof doc.url === 'string') {
              // Only fetch if URL is a full HTTP(S) URL (not a relative path)
              if (doc.url.startsWith('http://') || doc.url.startsWith('https://')) {
                console.log(`📥 Fetching file from URL for Cloudinary upload: ${doc.url}`)
                fileBuffer = await fetchFileFromUrl(doc.url)
                if (fileBuffer) {
                  uploadSource.push(`URL: ${doc.url}`)
                }
              }
            }

            // Upload to Cloudinary if we have a buffer
            if (fileBuffer && fileBuffer.length > 0) {
              console.log(`☁️  Uploading to Cloudinary (source: ${uploadSource.join(', ')})...`)
              
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
              
              console.log(`✓ Successfully uploaded to Cloudinary: ${uploadResult.secure_url}`)
              delete (req as unknown as Record<string, unknown>).isUpdatingCloudinary
              delete (req as any).fileBufferForCloudinary
              
              // Return updated doc with Cloudinary URL
              return {
                ...doc,
                publicUrl: uploadResult.secure_url,
                cloudinaryPublicId: uploadResult.public_id,
                url: uploadResult.secure_url,
              }
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
                
                return {
                  ...doc,
                  publicUrl: doc.url,
                  cloudinaryPublicId: publicId,
                  url: doc.url,
                }
              }
            } 
            // Last resort: Log warning but don't fail the request
            else {
              const errorMsg = `⚠️  Could not access file for Cloudinary upload: ${doc.filename || 'unknown'}`
              console.warn(errorMsg)
              console.warn(`   File URL: ${doc.url || 'none'}`)
              console.warn('   This may happen in serverless environments if file buffer is not available.')
              console.warn('   The file was saved, but Cloudinary upload will need to be done manually.')
              
              // In production, log more details for debugging
              if (process.env.NODE_ENV === 'production') {
                console.warn(`   Media ID: ${doc.id}`)
                console.warn(`   Request has fileBufferForCloudinary: ${!!(req as any).fileBufferForCloudinary}`)
                console.warn(`   Request has file: ${!!(req as any).file}`)
                console.warn(`   Request has files: ${!!(req as any).files}`)
              }
            }
          } catch (error) {
            // Don't fail the request if Cloudinary upload fails
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error('❌ Error uploading to Cloudinary:', errorMessage)
            console.error(`   File was still saved to database: ${doc.id}`)
            console.error(`   Filename: ${doc.filename || 'unknown'}`)
            
            // Log stack trace in development
            if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
              console.error('   Stack:', error.stack)
            }
          } finally {
            // Clean up
            delete (req as unknown as Record<string, unknown>).isUpdatingCloudinary
            delete (req as any).fileBufferForCloudinary
          }
        }

        // IMPORTANT: Only modify URLs during create operations that just uploaded to Cloudinary
        // For update operations, URL modification should happen in afterRead hook, not here
        // This prevents errors during PATCH/UPDATE operations
        if (operation === 'create') {
          // Ensure publicUrl and url are always set to Cloudinary URLs if available
          if (doc.cloudinaryPublicId && isCloudinaryConfigured) {
            try {
              const cloudinaryUrl = cloudinary.url(doc.cloudinaryPublicId as string, {
                secure: true,
              })
              
              // Always use Cloudinary URL if we have publicId
              return {
                ...doc,
                publicUrl: cloudinaryUrl,
                url: cloudinaryUrl,
              }
            } catch (error) {
              // If Cloudinary URL generation fails, log but don't break the request
              console.warn('⚠️  Failed to generate Cloudinary URL:', error)
              return doc
            }
          }
          
          // If publicUrl exists and is a Cloudinary URL, ensure url matches
          if (doc.publicUrl && typeof doc.publicUrl === 'string' && doc.publicUrl.includes('cloudinary.com')) {
            return {
              ...doc,
              url: doc.publicUrl,
            }
          }
          
          // Replace any localhost/Vercel URLs with Cloudinary URLs if we have Cloudinary data
          if (doc.url && typeof doc.url === 'string') {
            const isLocalOrVercel = 
              doc.url.includes('localhost') || 
              doc.url.includes('127.0.0.1') ||
              doc.url.includes('vercel.app') ||
              doc.url.includes('vercel.com')
            
            if (isLocalOrVercel) {
              if (doc.publicUrl && typeof doc.publicUrl === 'string' && doc.publicUrl.includes('cloudinary.com')) {
                return {
                  ...doc,
                  url: doc.publicUrl,
                }
              } else if (doc.cloudinaryPublicId && isCloudinaryConfigured) {
                try {
                  const cloudinaryUrl = cloudinary.url(doc.cloudinaryPublicId as string, {
                    secure: true,
                  })
                  return {
                    ...doc,
                    url: cloudinaryUrl,
                    publicUrl: cloudinaryUrl,
                  }
                } catch (error) {
                  // If Cloudinary URL generation fails, log but don't break the request
                  console.warn('⚠️  Failed to generate Cloudinary URL:', error)
                  return doc
                }
              }
            }
          }
        }

        // For update operations, just return the doc as-is
        // URL modification will happen in afterRead hook when the document is read
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
