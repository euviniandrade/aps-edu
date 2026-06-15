const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  env: {
    APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL || '',
  },
  images: {
    remotePatterns: [],
  },
}

module.exports = nextConfig
