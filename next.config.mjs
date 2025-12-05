/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/media/**',
      },
    ],
  },

  // Payload CMS compatibility
  transpilePackages: ['payload', '@payloadcms/db-mongodb'],

  // Suppress MongoDB optional dependency warnings
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'bson-ext': false,
      kerberos: false,
      '@mongodb-js/zstd': false,
      snappy: false,
      'mongodb-client-encryption': false,
    }

    // Handle SVG imports as URLs
    config.module.rules.push({
      test: /\.svg$/,
      type: 'asset/resource',
    })

    // Handle video file imports
    config.module.rules.push({
      test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)$/,
      type: 'asset/resource',
    })

    return config
  },
}

export default nextConfig
