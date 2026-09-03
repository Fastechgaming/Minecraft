import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        discord: {
          // Kept the "blurple" key (touched by many existing classes) but repointed it
          // to the site's green accent, per the near-black/green dashboard theme.
          blurple: '#22C55E',
          green: '#23A559',
          yellow: '#F0B232',
          red: '#DA373C',
          dark: '#0A0D0A',
          darker: '#050705',
          panel: '#0E120E',
          panel2: '#141914',
          border: '#1F2A20',
          muted: '#8B968E'
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
