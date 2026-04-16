import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 'standalone' é só para Docker — no Vercel não precisa
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
