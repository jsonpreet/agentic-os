/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/renderer/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0d0f12',
        surface: '#16191f',
        'surface-elevated': '#1d212a',
        'surface-hover': '#242a35',
        border: 'rgba(255, 255, 255, 0.08)',
        'border-focus': 'rgba(255, 255, 255, 0.2)',
        primary: '#3b82f6',
        'primary-hover': '#2563eb',
        accent: '#8b5cf6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444'
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          'Menlo',
          'Monaco',
          'Courier New',
          'monospace'
        ]
      }
    },
  },
  plugins: [],
};
