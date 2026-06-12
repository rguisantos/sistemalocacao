import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        feltro: { DEFAULT: '#1b5e3f', escuro: '#0e3a24', claro: '#2e7d52' },
        madeira: '#6d4c2f',
        giz: '#f5f2ea',
      },
    },
  },
  plugins: [],
} satisfies Config;
