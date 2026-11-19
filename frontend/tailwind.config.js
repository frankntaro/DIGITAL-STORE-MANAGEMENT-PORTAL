/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          800: '#1E293B',
          900: '#0F172A',
          950: '#090E1A',
        },
      },
    },
  },
  plugins: [],
};
