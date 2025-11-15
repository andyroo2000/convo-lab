/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // LanguageFlow Studio brand colors
        indigo: {
          DEFAULT: '#5E6AD8',
          50: '#F0F1FD',
          100: '#E1E4FB',
          200: '#C3C9F7',
          300: '#A5AEF3',
          400: '#8793EF',
          500: '#5E6AD8',
          600: '#4B55AD',
          700: '#384082',
          800: '#252B56',
          900: '#12162B',
        },
        teal: {
          DEFAULT: '#4EA6B1',
          50: '#EFF9FA',
          100: '#DFF3F5',
          200: '#BFE7EB',
          300: '#9FDBE1',
          400: '#7FC1C7',
          500: '#4EA6B1',
          600: '#3E858E',
          700: '#2F646B',
          800: '#1F4347',
          900: '#102124',
        },
        navy: '#1E2433',
        'warm-gray': '#DADCE3',
        'soft-sand': '#F7F5EF',
        'pale-sky': '#EEF3FB',
        coral: '#FF6A6A',
        mint: '#A6F2C2',
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
