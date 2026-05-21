/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // APPS_SCRIPT_URL é server-side (usada pelo proxy /api/[...slug])
  // Não precisa de NEXT_PUBLIC_ pois não é acessada pelo cliente
  env: {
    APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL || '',
  },

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

module.exports = nextConfig
