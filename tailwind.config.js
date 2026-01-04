/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        eprom: {
          bg: '#f8fafc', // Ultra light slate
          card: '#ffffff', 
          surface: '#f1f5f9', 
          blue: '#0f172a', // Shift primary to Slate 900 (Oil/Dark) for "Edgy" feel
          accent: '#3b82f6', // Bright Blue accent
          green: '#10b981', 
          text: '#0f172a', 
          muted: '#64748b', 
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'luxury-gradient': 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', // Premium Silver/White
        'dark-gradient': 'linear-gradient(to bottom, #0f172a, #1e293b)',
      }
    },
  },
  plugins: [],
}