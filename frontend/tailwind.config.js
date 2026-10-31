/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#F4EFE6',
          light: '#FAF7F2',
          card: '#FFFFFF',
        },
        ink: {
          DEFAULT: '#1A1A1A',
          muted: '#555555',
          light: '#777777',
        },
        brand: {
          orange: '#FF5B26',
          'orange-hover': '#E04815',
          teal: '#008080',
          'teal-hover': '#006E6E',
          slate: '#5C768D',
          amber: '#F59E0B',
          dark: '#18181B',
        },
      },
      fontFamily: {
        anton: ['Anton', 'sans-serif'],
        archivo: ['Archivo', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neo: '3px 3px 0px #1A1A1A',
        'neo-sm': '2px 2px 0px #1A1A1A',
        'neo-lg': '5px 5px 0px #1A1A1A',
        'neo-pressed': '1px 1px 0px #1A1A1A',
        'neo-orange': '3px 3px 0px #FF5B26',
      },
      borderRadius: {
        neo: '4px',
      },
      borderWidth: {
        DEFAULT: '2px',
        2: '2px',
      },
    },
  },
  plugins: [],
};
