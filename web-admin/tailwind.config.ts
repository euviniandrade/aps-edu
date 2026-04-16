import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: '#132C45',
        'primary-dark': '#003B55',
        navy: '#132C45',
        'navy-dark': '#003B55',
        gold: '#F8A303',
        'gold-light': '#FDCF38',
        accent: '#F8A303',
      },
    },
  },
  plugins: [],
}

export default config
