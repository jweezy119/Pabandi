/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6', // Teal focus
          600: '#0d9488',
          900: '#134e4a',
        },
        dark: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155'
        }
      }
    },
  },
  plugins: [],
}
