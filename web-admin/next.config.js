const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  env: {
    APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL || '',
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

module.exports = withPWA(nextConfig)
