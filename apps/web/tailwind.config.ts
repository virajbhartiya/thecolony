import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090d',
          900: '#0c0d12',
          800: '#13141b',
          700: '#1b1d27',
          600: '#262835',
          500: '#3a3d4d',
        },
        accent: {
          500: '#7ee787',
          600: '#5ccf65',
        },
        warning: '#f0883e',
        danger: '#f85149',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
