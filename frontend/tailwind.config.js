/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0C1D33',
        navysoft: '#12294a',
        primary: '#2563EB',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        page: '#F4F7FB',
      },
      boxShadow: {
        card: '0 1px 3px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.04)',
      },
    },
  },
  plugins: [],
};
