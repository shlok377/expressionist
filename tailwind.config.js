/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        editor: {
          bg: '#0f1117',
          surface: '#181b24',
          surfaceHover: '#222634',
          border: '#2a2f42',
          accent: '#6366f1',
          accentHover: '#4f46e5',
          active: '#3b82f6',
        }
      }
    },
  },
  plugins: [],
}
