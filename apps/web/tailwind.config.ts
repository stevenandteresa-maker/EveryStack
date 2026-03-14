import type { Config } from 'tailwindcss';
import tailwindAnimate from 'tailwindcss-animate';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        tablet: '768px',
        desktop: '1440px',
      },
      fontSize: {
        'page-title': ['28px', { lineHeight: '36px', fontWeight: '700' }],
        h1: ['24px', { lineHeight: '32px', fontWeight: '700' }],
        h2: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
        body: ['14px', { lineHeight: '20px' }],
        'body-sm': ['13px', { lineHeight: '18px' }],
        caption: ['12px', { lineHeight: '16px' }],
        timestamp: ['11px', { lineHeight: '14px' }],
      },
      colors: {
        /* ── EveryStack tokens ── */
        sidebar: {
          bg: 'var(--sidebar-bg)',
          'bg-hover': 'var(--sidebar-bg-hover)',
          text: 'var(--sidebar-text)',
          'text-muted': 'var(--sidebar-text-muted)',
          active: 'var(--sidebar-active)',
        },
        content: { bg: 'var(--content-bg)' },
        panel: { bg: 'var(--panel-bg)' },
        card: {
          bg: 'var(--card-bg)',
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
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
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },

        /* ── shadcn/ui required colors ── */
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: 'calc(var(--radius) - 2px)',
        lg: '12px',
        xl: 'calc(var(--radius) + 4px)',
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
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;
