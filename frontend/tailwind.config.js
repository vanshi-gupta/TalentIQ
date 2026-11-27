/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#050816', 900: '#080d22', 800: '#0d1430', 700: '#141d42', 600: '#1d2859' },
        brand: { blue: '#3b82f6', electric: '#2f6bff', purple: '#8b5cf6', violet: '#a78bfa', cyan: '#22d3ee' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { fadeUp: 'fadeUp .35s ease-out both' },
    },
  },
  plugins: [],
}
