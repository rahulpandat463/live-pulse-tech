/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        background: '#0d0d1a',
        card: '#1a1a2e',
        accent: '#ff4d00',
        border: '#2d2d44',
      },
    },
  },
  plugins: [],
}
