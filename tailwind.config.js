/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f7ff',
          100: '#e9efff',
          500: '#1857c6',
          700: '#103f93',
          900: '#0a2a63'
        }
      }
    }
  },
  plugins: []
};
