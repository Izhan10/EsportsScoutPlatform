import type { Config } from 'tailwindcss'

const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: '#1E293B',
        input: '#1E293B',
        ring: '#9EFF00',
        background: '#07111E',
        foreground: '#E2E8F0',
        card: {
          DEFAULT: '#0D1B2A',
          foreground: '#E2E8F0',
        },
        primary: {
          DEFAULT: '#9EFF00',
          foreground: '#07111E',
        },
        success: '#9EFF00',
        warning: '#F59E0B',
        destructive: '#EF4444',
        purple: {
          DEFAULT: '#A855F7',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#1E293B',
          foreground: '#94A3B8',
        },
        accent: {
          DEFAULT: '#A855F7',
          foreground: '#FFFFFF',
        },
        sidebar: {
          DEFAULT: '#0A1628',
          foreground: '#94A3B8',
          active: '#1A2A44',
        },
        glass: {
          DEFAULT: 'rgba(13, 27, 42, 0.8)',
          border: 'rgba(158, 255, 0, 0.15)',
        },
      },
      borderRadius: {
        xl: '1rem',
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.25rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.05)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        pulse: 'pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config

export default config