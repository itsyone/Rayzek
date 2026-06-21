/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mapped to CSS variables defined in index.css so the theme is tokenised.
        bg: 'rgb(var(--rz-bg) / <alpha-value>)',
        panel: 'rgb(var(--rz-panel) / <alpha-value>)',
        elevated: 'rgb(var(--rz-elevated) / <alpha-value>)',
        border: 'rgb(var(--rz-border) / <alpha-value>)',
        text: 'rgb(var(--rz-text) / <alpha-value>)',
        muted: 'rgb(var(--rz-muted) / <alpha-value>)',
        accent: 'rgb(var(--rz-accent) / <alpha-value>)',
        warn: 'rgb(var(--rz-warn) / <alpha-value>)',
        danger: 'rgb(var(--rz-danger) / <alpha-value>)',
        ok: 'rgb(var(--rz-ok) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px -12px rgb(0 0 0 / 0.6)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in': { from: { transform: 'translateX(8px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        pulse_ring: { '0%': { transform: 'scale(0.8)', opacity: '0.7' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
        'pulse-ring': 'pulse_ring 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
