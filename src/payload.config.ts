import { mongooseAdapter } from '@payloadcms/db-mongodb'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { AccommodationPages } from './collections/AccommodationPages'
import { Blog } from './collections/Blog'
import { DestinationPages } from './collections/DestinationPages'
import { ExperiencePages } from './collections/ExperiencePages'
import { Gallery } from './collections/Gallery'
import { ItineraryPages } from './collections/ItineraryPages'
import { Maldives } from './collections/Maldives'
import { Media } from './collections/Media'
import { Testimonials } from './collections/Testimonials'
import { TripConfiguration } from './collections/TripConfiguration'
import { Users } from './collections/Users'
import { VehicleConfiguration } from './collections/VehicleConfiguration'
import { VisitingPlaces } from './collections/VisitingPlaces'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users',
  },
  collections: [
    Users,
    Media,
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
