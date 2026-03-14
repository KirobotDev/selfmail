/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.ejs',
    './assets/js/**/*.js',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c4d3ff',
          300: '#a3b8ff',
          400: '#7c93ff',
          500: '#5b6ef7',
          600: '#4452eb',
          700: '#3540d0',
          800: '#2c34a8',
          900: '#272f84',
          950: '#181d53',
        },
        dark: {
          900: '#0d0f1a',
          800: '#12152a',
          700: '#181c35',
          600: '#1e2340',
          500: '#252c50',
        },
      },
      animation: {
        'slide-in': 'slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        slideIn: {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceIn: {
          '0%':  { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.05)' },
          '100%':{ transform: 'scale(1)',   opacity: '1' },
        },
        glow: {
          '0%':   { boxShadow: '0 0 20px rgba(91, 110, 247, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(91, 110, 247, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
