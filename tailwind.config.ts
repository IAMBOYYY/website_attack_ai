import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#050607',
        panel: '#0a0d10',
        edge: '#151a1f',
        edge2: '#1f262d',
        mute: '#5b6570',
        dim: '#8b96a3',
        ink: '#d7dee6',
        acid: '#7dff9b',
        cyan: '#5fd4ff',
        amber: '#ffb454',
        red: '#ff5c5c',
        violet: '#b48cff',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        pulse2: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
        scan: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } },
      },
      animation: { pulse2: 'pulse2 1.4s ease-in-out infinite', scan: 'scan 4s linear infinite' },
    },
  },
  plugins: [],
};
export default config;
