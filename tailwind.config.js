/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
      colors: {
        m3: {
          surface: '#111318',
          'surface-dim': '#111318',
          'surface-bright': '#37393e',
          'surface-container-lowest': '#0c0e13',
          'surface-container-low': '#191c20',
          'surface-container': '#1d2024',
          'surface-container-high': '#282a2f',
          'surface-container-highest': '#33353a',
          'on-surface': '#e2e2e9',
          'on-surface-variant': '#c4c6d0',
          outline: '#8e9099',
          'outline-variant': '#44474f',
          primary: '#a8c7fa',
          'on-primary': '#062e6f',
          'primary-container': '#0842a0',
          'on-primary-container': '#d3e3fd',
          'secondary-container': '#3f4759',
          'on-secondary-container': '#dbe2f9',
          error: '#f2b8b5',
          'on-error': '#601410',
          'error-container': '#8c1d18',
          'on-error-container': '#f9dedc',
        }
      }
    },
  },
  plugins: [],
}
