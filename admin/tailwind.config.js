/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#14151A',
        surface: '#1D1F26',
        'surface-hover': '#242630',
        border: '#2A2D37',
        'text-primary': '#F5F5F7',
        'text-secondary': '#9195A3',
        brand: {
          red: '#EE2329',
          'red-dim': '#3A1417',
          green: '#73BF43',
          'green-dim': '#1D2A13'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      }
    }
  },
  plugins: []
};
