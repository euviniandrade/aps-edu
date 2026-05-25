/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL || '',
  },
  images: {
    remotePatterns: [],
  },
}

module.exports = nextConfig
