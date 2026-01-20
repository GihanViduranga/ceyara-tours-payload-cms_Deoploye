import type { CollectionConfig } from 'payload'

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
        description: 'Public URL of the image stored in Google Cloud Storage',
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
        // Before saving, copy url to publicUrl if url exists
        // The GCS storage adapter sets the url field during upload
        // We copy it to publicUrl for explicit access
        if (data.url && typeof data.url === 'string') {
          data.publicUrl = data.url
        }

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
    afterChange: [
      async ({ doc, req, operation }) => {
        // After upload, ensure publicUrl is always set with the GCS public URL
        // The GCS storage adapter sets doc.url with the public URL
        // Format: https://storage.googleapis.com/bucket-name/filename.jpg

        // Use a flag to prevent infinite recursion when updating
        const isUpdatingPublicUrl = (req as unknown as Record<string, unknown>).isUpdatingPublicUrl
        if (isUpdatingPublicUrl) {
          return doc
        }

        if (doc.url && typeof doc.url === 'string') {
          const docWithPublicUrl = doc as Record<string, unknown>
          const currentPublicUrl = docWithPublicUrl.publicUrl

          // Always update publicUrl if:
          // 1. It doesn't exist
          // 2. It doesn't match the url
          // 3. It's not a string (might be an object ID)
          const needsUpdate =
            !currentPublicUrl ||
            currentPublicUrl !== doc.url ||
            typeof currentPublicUrl !== 'string'

          if (needsUpdate && doc.id) {
            // For create operations, delay the update slightly to ensure document is fully saved
            // For update operations, try immediately
            const updateDelay = operation === 'create' ? 200 : 0

            setTimeout(async () => {
              let updateError: unknown = null
              try {
                // Set flag to prevent recursion
                ;(req as unknown as Record<string, unknown>).isUpdatingPublicUrl = true

                // Use Payload's update method to save the publicUrl
                await req.payload.update({
                  collection: 'media',
                  id: doc.id,
                  data: {
                    publicUrl: doc.url,
                  },
                })
                console.log('✓ Saved publicUrl to database:', doc.url)
              } catch (error) {
                updateError = error
                // Log error but don't fail the upload
                // The error might be due to document not being fully saved yet
                // or access control issues - this is non-critical
                if (
                  error &&
                  typeof error === 'object' &&
                  'status' in error &&
                  error.status === 404
                ) {
                  // Document not found - might be a timing issue, try once more after a delay
                  setTimeout(async () => {
                    try {
                      await req.payload.update({
                        collection: 'media',
                        id: doc.id,
                        data: {
                          publicUrl: doc.url,
                        },
                      })
                      console.log('✓ Saved publicUrl to database (retry):', doc.url)
                    } catch (retryError) {
                      // Silently fail - publicUrl will be set on next update
                      console.warn('Failed to save publicUrl (retry failed):', retryError)
                    } finally {
                      delete (req as unknown as Record<string, unknown>).isUpdatingPublicUrl
                    }
                  }, 500)
                  return // Don't clear flag yet, retry will do it
                } else {
                  console.warn('Failed to save publicUrl to database:', error)
                }
              } finally {
                // Clear flag if not retrying (retry will clear it)
                const isRetrying =
                  updateError &&
                  typeof updateError === 'object' &&
                  'status' in updateError &&
                  updateError.status === 404
                if (!isRetrying) {
                  delete (req as unknown as Record<string, unknown>).isUpdatingPublicUrl
                }
              }
            }, updateDelay)
          }
        } else if (!doc.url && operation === 'create') {
          // If url is not set yet, try to construct it from filename and bucket
          const bucketName = process.env.GCP_BUCKET_NAME
          const filename = (doc as Record<string, unknown>).filename
          if (bucketName && filename && typeof filename === 'string' && doc.id) {
            // Construct the public URL for GCS
            // GCS public URLs format: https://storage.googleapis.com/bucket-name/path/to/file
            const constructedUrl = `https://storage.googleapis.com/${bucketName}/${filename}`

            // Delay update to ensure document is fully saved
            setTimeout(async () => {
              try {
                // Set flag to prevent recursion
                ;(req as unknown as Record<string, unknown>).isUpdatingPublicUrl = true

                // Use Payload's update method to save the constructed URL
                await req.payload.update({
                  collection: 'media',
                  id: doc.id,
                  data: {
                    publicUrl: constructedUrl,
                  },
                })
                console.log('✓ Constructed and saved publicUrl:', constructedUrl)
              } catch (error) {
                console.warn('Failed to construct and save publicUrl:', error)
              } finally {
                // Clear flag
                delete (req as unknown as Record<string, unknown>).isUpdatingPublicUrl
              }
            }, 200)
          }
        }
        return doc
      },
    ],
  },
}
