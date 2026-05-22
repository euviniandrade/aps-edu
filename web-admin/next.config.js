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

// PWA — opcional: só ativa se o pacote estiver instalado
try {
  const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    buildExcludes: [/middleware-manifest\.json$/],
  })
  module.exports = withPWA(nextConfig)
} catch (_) {
  // next-pwa não instalado — build normal sem SW
  module.exports = nextConfig
}
