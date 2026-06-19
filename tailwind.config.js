export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        accent: '#00D4C8',
        accent2: '#FF6B00',
        muted: '#888888',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Bebas Neue', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 60px rgba(0, 212, 200, 0.35)',
      },
    },
  },
  plugins: [],
};
