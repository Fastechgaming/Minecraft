import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        discord: {
          blurple: '#5865F2',
          green: '#23A559',
          yellow: '#F0B232',
          red: '#DA373C',
          dark: '#1E1F22',
          darker: '#111214',
          panel: '#2B2D31',
          panel2: '#313338',
          border: '#3F4147',
          muted: '#949BA4'
        }
      },
      boxShadow: {
        panel: '0 1px 0 rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.25)'
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'progress-shine': { '0%': { backgroundPosition: '0 0' }, '100%': { backgroundPosition: '200% 0' } }
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'progress-shine': 'progress-shine 2s linear infinite'
      }
    }
  },
  plugins: []
};

export default config;
