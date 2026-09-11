const colour = name => 'rgb(var(--' + name + ') / <alpha-value>)';
const scale = (name, steps) => Object.fromEntries(steps.map(step => [step, colour(name + '-' + step)]));

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: scale('primary', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        surface: scale('surface', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        red: { 300: colour('error-text'), 400: colour('error-text'), 500: '#a63b36', 600: '#912f2b', 900: colour('error-border'), 950: colour('error-surface') },
        green: { 300: colour('success-text'), 400: colour('success-text'), 900: colour('success-border'), 950: colour('success-surface') },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Lora', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: { 'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.45' } } },
      animation: { 'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite' },
    },
  },
  plugins: [],
};
