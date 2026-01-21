import { mongooseAdapter } from '@payloadcms/db-mongodb'
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

// Verify Cloudinary configuration
const useCloudinaryStorage = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
)

if (!useCloudinaryStorage) {
  console.warn('⚠️  Cloudinary Storage not configured. Using local storage.')
  console.warn('   Required environment variables:')
  console.warn('   - CLOUDINARY_CLOUD_NAME')
  console.warn('   - CLOUDINARY_API_KEY')
  console.warn('   - CLOUDINARY_API_SECRET')
} else {
  console.log('✓ Cloudinary Storage configured')
}

// Verify MongoDB configuration
const databaseUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/ceyara-tours'
if (!process.env.DATABASE_URI) {
  console.warn('⚠️  DATABASE_URI not set. Using default local MongoDB connection.')
  console.warn('   Set DATABASE_URI in your .env file for production.')
} else if (databaseUri.includes('username:password') || databaseUri.includes('your-')) {
  console.error('❌ DATABASE_URI appears to contain placeholder values!')
  console.error('   Please update your .env file with a valid MongoDB connection string.')
} else {
  console.log('✓ MongoDB connection string configured')
}

export default buildConfig({
  admin: {
    user: 'users',
  },
  collections: [
    Users,
    // Media collection uses Cloudinary via hooks
    MediaCollection,
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
    // Cloudinary integration is handled via hooks in Media collection
  ],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  secret: process.env.PAYLOAD_SECRET || 'your-secret-key-here',
  sharp,
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || 'mongodb://localhost:27017/ceyara-tours',
    connectOptions: {
      connectTimeoutMS: 60000, // Increase timeout to 60 seconds
      socketTimeoutMS: 60000,
      serverSelectionTimeoutMS: 60000,
      retryWrites: true,
      retryReads: true,
    },
  }),
})
