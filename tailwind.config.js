/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'void': '#0A0E14',
        'panel': '#11161E',
        'elevated': '#1A2029',
        'border-subtle': '#1F2937',
        'border-default': '#2D3748',
        'text-primary': '#E8ECEF',
        'text-secondary': '#9CA3AF',
        'text-tertiary': '#6B7280',
        'accent-cyan': '#00D4FF',
        'accent-amber': '#FFB020',
        'accent-red': '#FF3838',
        'accent-green': '#00E676',
        'accent-violet': '#A78BFA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-in',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
