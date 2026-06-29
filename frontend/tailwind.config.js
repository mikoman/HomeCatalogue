/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Safety-yellow accent ramp — actions, brand, active states
        primary: {
          50: '#FFFCEB',
          100: '#FFF5C2',
          200: '#FFEA85',
          300: '#FFDE47',
          400: '#FFD11F',
          500: '#FFC700', // core
          600: '#E0A800',
          700: '#A37800',
          800: '#6B4F00',
          900: '#3D2D00',
        },
        // Warm near-black charcoal ramp — canvas, panels, lines, text
        surface: {
          50: '#FAFAFA',
          100: '#F4F4F5', // headings
          200: '#E4E4E7',
          300: '#C7C7CD', // body text
          400: '#9A9AA3', // secondary text
          500: '#6B6B73', // muted / placeholder
          600: '#46464D',
          700: '#2C2C31', // hover borders
          800: '#1E1E22', // borders
          900: '#141416', // cards / nav panels
          950: '#0A0A0B', // app canvas
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,199,0,0.4), 0 8px 30px -8px rgba(255,199,0,0.25)',
      },
      keyframes: {
        'rise': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'rise': 'rise 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
