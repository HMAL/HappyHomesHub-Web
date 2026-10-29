import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', '"Playfair Fallback"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Semantic brand tokens — use these on public/marketing pages instead of raw hex.
        ink: '#0D1F2D',        // primary dark surface + text on light
        'ink-deep': '#091621', // darker panel inside ink surfaces
        gold: '#D4972A',       // landlord accent (primary marketing accent)
        teal: '#00C8BB',       // tenant accent
        leaf: '#34D399',       // handyman accent
        // Landlord palette
        landlord: {
          DEFAULT: '#0D1F2D',
          50: '#E8EDF1',
          100: '#C5D2DC',
          accent: '#D4972A',
          'accent-light': '#F2C76A',
        },
        // Tenant palette
        tenant: {
          DEFAULT: '#12202E',
          50: '#E7EDF3',
          100: '#C2D1DF',
          accent: '#00C8BB',
          'accent-light': '#5EEAE0',
        },
        // Handyman palette
        handyman: {
          DEFAULT: '#1B3A2F',
          50: '#E8F0ED',
          100: '#C0D6CD',
          accent: '#34D399',
          'accent-light': '#6EE7B7',
        },
      },
    },
  },
  plugins: [],
}

export default config
