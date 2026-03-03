import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: 'var(--sidebar-bg)',
          'bg-hover': 'var(--sidebar-bg-hover)',
          text: 'var(--sidebar-text)',
          'text-muted': 'var(--sidebar-text-muted)',
          active: 'var(--sidebar-active)',
        },
        content: { bg: 'var(--content-bg)' },
        panel: { bg: 'var(--panel-bg)' },
        card: { bg: 'var(--card-bg)' },
        border: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
        },
        elevated: { bg: 'var(--bg-elevated)' },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        state: {
          success: 'var(--success)',
          warning: 'var(--warning)',
          error: 'var(--error)',
        },
        accent: 'var(--accent)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
      },
      spacing: {
        'card-padding': '20px',
        'section-gap': '16px',
        'section-gap-lg': '28px',
        'mobile-bottom-nav': '56px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
