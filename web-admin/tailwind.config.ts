import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1B5E8C',
        'primary-dark': '#0D3F6B',
        accent: '#FFB300',
      },
    },
  },
  plugins: [],
}

export default config
