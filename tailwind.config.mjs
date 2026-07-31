/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      colors: {
        // Dark theme palette
        bg: {
          primary: '#080810',
          secondary: '#0f0f1a',
          tertiary: '#161625',
          card: '#12121e',
          hover: '#1a1a2e',
        },
        accent: {
          purple: '#7c3aed',
          'purple-light': '#a78bfa',
          'purple-dim': '#4c1d95',
          violet: '#6d28d9',
          indigo: '#4338ca',
          cyan: '#06b6d4',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
        },
        border: {
          default: '#1e1e35',
          subtle: '#161625',
          accent: '#7c3aed',
          hover: '#a78bfa',
        },
        text: {
          primary: '#f0f0ff',
          secondary: '#9898c0',
          muted: '#5a5a80',
          accent: '#a78bfa',
        },
      },
      backgroundImage: {
        'noise': "url('/noise.svg')",
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.25), transparent)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease forwards',
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-out-right': 'slideOutRight 0.3s ease forwards',
        'marquee': 'marquee 30s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(124,58,237,0.4)',
        'glow-sm': '0 0 10px rgba(124,58,237,0.2)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'panel': '0 0 60px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
