/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ConvoLab warm, playful color palette
        // Base colors
        'cream': '#FCF9F4',
        'warm-cream': '#FAF6F0',
        'dark-brown': '#4B1800',
        'medium-brown': '#8B5A3C',
        'light-brown': '#C19A7E',

        // Playful accent colors
        'strawberry': {
          DEFAULT: '#FC66A7',
          light: '#FFE5F1',
          dark: '#D84A89',
        },
        'coral': {
          DEFAULT: '#FC8155',
          light: '#FFE8DF',
          dark: '#E86234',
        },
        'periwinkle': {
          DEFAULT: '#6796EC',
          light: '#E5EEFB',
          dark: '#4A73C4',
        },
        'keylime': {
          DEFAULT: '#748C00',  // Dark green from hurryupandhavefun.com
          light: '#E8EDCC',
          dark: '#5A6C00',
        },
        'yellow': {
          DEFAULT: '#FFCC3F',  // Yellow from hurryupandhavefun.com
          light: '#FFF4D6',
          dark: '#E6B52E',
        },
        'lilac': {
          DEFAULT: '#EBDBFF',
          light: '#F7F1FF',
          dark: '#C4A8E8',
        },
        'mint': {
          DEFAULT: '#E5F6E7',
          light: '#F2FBF3',
          dark: '#A8E6AD',
        },
        'olive': {
          DEFAULT: '#748C00',
          light: '#E8EDCC',
          dark: '#5A6C00',
        },
        'violet': {
          DEFAULT: '#A45AFE',
          light: '#EBE0FF',
          dark: '#7D3DC7',
        },

        // Legacy colors for backward compatibility
        indigo: {
          DEFAULT: '#6796EC',
          50: '#E5EEFB',
          500: '#6796EC',
          600: '#4A73C4',
          700: '#3A5BA0',
        },
        teal: {
          DEFAULT: '#4EA6B1',
          500: '#4EA6B1',
          600: '#3E858E',
        },
        navy: '#4B1800',
        'warm-gray': '#C19A7E',
        'soft-sand': '#FCF9F4',
        'pale-sky': '#E5EEFB',
      },
      animation: {
        'flow-wave': 'flow-wave 3s ease-in-out infinite',
        'flow-pulse': 'flow-pulse 2s ease-in-out infinite',
        'fadeIn': 'fadeIn 0.2s ease-out',
        'slideUp': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        'flow-wave': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'flow-pulse': {
          '0%, 100%': { opacity: '0.8' },
          '50%': { opacity: '1' },
        },
        'fadeIn': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slideUp': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
