import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-orange': 'var(--theme-primary, #FF6B35)',
        'primary-orange-dark': 'var(--theme-primary-dark, #E55A2B)',
        'primary-orange-light': 'var(--theme-primary-light, #FF8C5A)',
        surface: {
          '0': '#ffffff',
          '1': '#f8fafc',
          '2': '#f1f5f9',
          '3': '#e2e8f0',
          '4': '#cbd5e1',
        },
        accent: {
          green: '#059669',
          'green-dim': '#047857',
          gold: '#d97706',
          'gold-dim': '#b45309',
          blue: '#2563eb',
          purple: '#7c3aed',
          red: '#dc2626',
          orange: 'var(--theme-primary, #FF6B35)',
          'superjoin-orange': 'var(--theme-primary, #FF6B35)',
        },
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          muted: '#64748b',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '2px',
        md: '2px',
        lg: '3px',
        xl: '3px',
        '2xl': '3px',
        '3xl': '3px',
        full: '9999px',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
