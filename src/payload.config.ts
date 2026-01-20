import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { gcsStorage } from '@payloadcms/storage-gcs'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { AccommodationPages } from './collections/AccommodationPages'
import { Blog } from './collections/Blog'
import { DestinationPages } from './collections/DestinationPages'
import { Drivers } from './collections/Drivers'
import { ExperiencePages } from './collections/ExperiencePages'
import { Gallery } from './collections/Gallery'
import { Guides } from './collections/Guides'
import { Hotels } from './collections/Hotels'
import { ItineraryPages } from './collections/ItineraryPages'
import { TourRequest } from './collections/TourRequest'
import { Maldives } from './collections/Maldives'
import { Media as MediaCollection } from './collections/Media'
import { Testimonials } from './collections/Testimonials'
import { TripConfiguration } from './collections/TripConfiguration'
import { Users } from './collections/Users'
import { VehicleConfiguration } from './collections/VehicleConfiguration'
import { VisitingPlaces } from './collections/VisitingPlaces'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Resolve GCS key file path
const getGcsKeyFilePath = (): string => {
  if (process.env.GCP_KEY_FILE) {
    return path.isAbsolute(process.env.GCP_KEY_FILE)
      ? process.env.GCP_KEY_FILE
      : path.resolve(process.cwd(), process.env.GCP_KEY_FILE)
  }
  return path.resolve(process.cwd(), 'gcp-service-account.json')
}

const gcsKeyFilePath = getGcsKeyFilePath()

// Verify the key file exists and is valid JSON
let gcsKeyFileValid = false
if (existsSync(gcsKeyFilePath)) {
  try {
    const keyFileContent = readFileSync(gcsKeyFilePath, 'utf8')
    const parsed = JSON.parse(keyFileContent)
    if (parsed.type === 'service_account' && parsed.private_key && parsed.client_email) {
      gcsKeyFileValid = true
      console.log('✓ GCS credentials file validated:', gcsKeyFilePath)
    } else {
      console.error('✗ GCS credentials file is missing required fields')
    }
  } catch (error) {
    console.error('✗ GCS credentials file is not valid JSON:', error)
  }
} else {
  console.error('✗ GCS credentials file not found at:', gcsKeyFilePath)
  console.error('  Please ensure the file exists and the path is correct.')
}

// Determine if GCS storage will be used
const useGcsStorage = process.env.GCP_BUCKET_NAME && gcsKeyFileValid && existsSync(gcsKeyFilePath)

// Warn if GCS storage cannot be initialized
if (!useGcsStorage && process.env.GCP_BUCKET_NAME) {
  console.warn('⚠️  GCS Storage plugin will not be initialized.')
  if (!process.env.GCP_BUCKET_NAME) {
    console.warn('   Missing: GCP_BUCKET_NAME environment variable')
  }
  if (!gcsKeyFileValid) {
    console.warn('   Invalid or missing GCS credentials file')
  }
}

export default buildConfig({
  admin: {
    user: 'users',
  },
  collections: [
    Users,
    // Configure Media collection - add staticDir if GCS is not configured
    useGcsStorage
      ? MediaCollection
      : (() => {
          const mediaConfig = { ...MediaCollection }
          if (mediaConfig.upload && typeof mediaConfig.upload === 'object') {
            mediaConfig.upload = {
              ...mediaConfig.upload,
              staticDir: 'media',
            }
          } else {
            mediaConfig.upload = {
              staticDir: 'media',
            }
          }
          return mediaConfig
        })(),
    ItineraryPages,
    AccommodationPages,
    DestinationPages,
    ExperiencePages,
    Gallery,
    Testimonials,
    Maldives,
    Blog,
    TripConfiguration,
    VehicleConfiguration,
    VisitingPlaces,
    Drivers,
    Guides,
    Hotels,
    TourRequest,
  ],
  plugins: [
    ...(useGcsStorage
      ? [
          gcsStorage({
            collections: {
              media: true,
            },
            bucket: process.env.GCP_BUCKET_NAME!,
            options: {
              projectId: process.env.GCP_PROJECT_ID,
              keyFilename: gcsKeyFilePath,
            },
          }),
        ]
      : []),
  ],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  secret: process.env.PAYLOAD_SECRET || 'your-secret-key-here',
  sharp,
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || 'mongodb://localhost:27017/ceyara-tours',
  }),
})
