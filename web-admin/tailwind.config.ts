import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // EA Brand primary navy
        primary: {
          DEFAULT: '#1B3A6B',
          light: '#2A5298',
          dark: '#112850',
          50: '#EEF3FA',
          100: '#D4E0F3',
          200: '#A8C0E6',
          300: '#7DA0D9',
          400: '#5180CC',
          500: '#1B3A6B',
          600: '#152E56',
          700: '#112445',
          800: '#0C1A34',
          900: '#070F1E',
        },
        // Gold / amber accent
        gold: {
          DEFAULT: '#F8A303',
          light: '#FDCF38',
          dark: '#D48A02',
        },
        accent: '#F8A303',
        // APS30 brand colors
        'aps-yellow': '#F9C234',
        'aps-cyan': '#29ABE2',
        'aps-orange': '#E07B39',
        'aps-blue': '#1B5FAD',
        // Legacy aliases
        navy: '#1B3A6B',
        'navy-dark': '#112850',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.07)',
        'card-md': '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06)',
        'card-lg': '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.06)',
      },
      backgroundImage: {
        'ea-gradient': 'linear-gradient(150deg, #1B3A6B 0%, #112850 55%, #0A1E40 100%)',
        'gold-gradient': 'linear-gradient(135deg, #F8A303 0%, #FDCF38 100%)',
      },
    },
  },
  plugins: [],
}

export default config
