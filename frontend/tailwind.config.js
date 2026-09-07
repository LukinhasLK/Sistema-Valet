/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#E6F1FB',
          100: '#B5D4F4',
          500: '#378ADD',
          600: '#185FA5',
          700: '#0C447C',
          800: '#042C53',
        },
        hp: {
          bg:      '#0A0A0A',
          surface: '#111111',
          card:    '#181818',
          border:  '#252525',
          hover:   '#202020',
          red:     '#D4302A',
          'red-h': '#E84A44',
          'red-d': '#A8251F',
          gray:    '#888888',
          muted:   '#555555',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'red-glow':  '0 0 20px rgba(212, 48, 42, 0.35)',
        'red-glow2': '0 0 40px rgba(212, 48, 42, 0.20)',
        'card':      '0 1px 3px rgba(0,0,0,0.6)',
      },
      animation: {
        'pulse-red': 'pulseRed 2s ease-in-out infinite',
      },
      keyframes: {
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212,48,42,0)' },
          '50%':      { boxShadow: '0 0 20px 4px rgba(212,48,42,0.3)' },
        },
      },
    },
  },
  plugins: [],
}
