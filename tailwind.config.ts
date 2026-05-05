// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
      colors: {
        // Brand
        brand: {
          navy: '#283D6D',
          gold: '#D4AF37',
        },
        // Primary
        primary: {
          DEFAULT: '#0f2756',
          container: '#283d6d',
          'on-container': '#95a9e0',
          fixed: '#dae2ff',
          'fixed-dim': '#b1c5fe',
          'on-fixed': '#001946',
          'on-fixed-variant': '#314576',
        },
        'on-primary': '#ffffff',
        'inverse-primary': '#b1c5fe',
        // Secondary (Gold)
        secondary: {
          DEFAULT: '#735c00',
          container: '#fed65b',
          'on-container': '#745c00',
          fixed: '#ffe088',
          'fixed-dim': '#e9c349',
          'on-fixed': '#241a00',
          'on-fixed-variant': '#574500',
        },
        'on-secondary': '#ffffff',
        // Tertiary
        tertiary: {
          DEFAULT: '#26292a',
          container: '#3c3f40',
          'on-container': '#a8aaab',
        },
        'on-tertiary': '#ffffff',
        // Surface
        surface: {
          DEFAULT: '#f9f9ff',
          dim: '#cfdaf1',
          bright: '#f9f9ff',
          tint: '#495d8f',
          variant: '#d8e3fa',
          'container-lowest': '#ffffff',
          'container-low': '#f0f3ff',
          container: '#e7eeff',
          'container-high': '#dee8ff',
          'container-highest': '#d8e3fa',
        },
        'on-surface': '#111c2c',
        'on-surface-variant': '#44464f',
        'inverse-surface': '#263142',
        'inverse-on-surface': '#ebf1ff',
        // Outline
        outline: {
          DEFAULT: '#757780',
          variant: '#c5c6d0',
        },
        // Semantic
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
          'on-container': '#93000a',
        },
        'on-error': '#ffffff',
        // Background
        background: '#f9f9ff',
        'on-background': '#111c2c',
      },
      spacing: {
        'xs': '4px',
        'sm': '12px',
        'md': '24px',
        'lg': '48px',
        'xl': '80px',
        'base': '8px',
        'gutter': '24px',
        'margin': '32px',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.25rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px',
      },
      fontSize: {
        'h1': ['48px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h2': ['32px', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '600' }],
        'h3': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'label-sm': ['14px', { lineHeight: '1.4', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-xs': ['12px', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      boxShadow: {
        sm: '0 1px 4px 0 rgba(40, 61, 109, 0.06)',
        DEFAULT: '0 4px 12px 0 rgba(40, 61, 109, 0.08)',
        lg: '0 8px 24px 0 rgba(40, 61, 109, 0.10)',
      },
    },
  },
  plugins: [],
}

export default config
