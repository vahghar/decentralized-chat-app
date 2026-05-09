/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
      },
      colors: {
        // These MUST match the CSS variable names exactly
        bg:      'var(--bg)',
        surface: 'var(--surface)',
        border:  'var(--border)',
        muted:   'var(--text-muted)',
        dim:     'var(--text-dim)',
        // 'fg' = foreground (text color)
        fg:      'var(--text)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}