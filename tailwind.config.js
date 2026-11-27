/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FFFDF7',
        lavender: {
          50: '#F8F4FF',
          100: '#E9DFFF',
          200: '#CDBBFF',
          300: '#B094FF',
          500: '#7D5CE6',
          600: '#6746D4',
        },
        mint: {
          100: '#D8F3E8',
          200: '#B5E8D3',
          700: '#236B50',
        },
        peach: {
          100: '#FFE3D5',
          200: '#FFC7AD',
          700: '#B94D48',
        },
        butter: {
          100: '#FFF1BD',
          200: '#FFE488',
          700: '#8A5D12',
        },
        babyblue: {
          100: '#DCEEFF',
          200: '#BCDDFF',
          700: '#2C598F',
        },
        plum: {
          950: '#29234A',
          900: '#34264A',
          700: '#534171',
          600: '#685489',
          400: '#8C79AE',
        },
        accent: {
          DEFAULT: '#7D5CE6',
          soft: '#CDBBFF',
          deep: '#6746D4',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Manrope Variable"', 'Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 10px 30px -18px rgba(52, 38, 74, 0.16), 0 2px 8px -4px rgba(125, 92, 230, 0.08)',
        lift: '0 18px 42px -20px rgba(52, 38, 74, 0.22), 0 4px 12px -4px rgba(125, 92, 230, 0.12)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .4s cubic-bezier(.22,.8,.3,1) both',
      },
    },
  },
  plugins: [],
};
