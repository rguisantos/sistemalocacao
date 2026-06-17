import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        feltro: { DEFAULT: '#11392B', escuro: '#0C2A20', claro: '#1C5340' }, // verde mesa de sinuca
        latao:  { DEFAULT: '#C08A2D', claro: '#D8A949' },                      // ficha/bronze
        tinta:  '#14201A',
        suave:  '#6B7B72',
        papel:  '#F7F8F6',
        borda:  '#E3E7E3',
        alerta: '#B4452F',
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        corpo: ['Inter', 'system-ui', 'sans-serif'],
        ficha: ['"JetBrains Mono"', 'ui-monospace', 'monospace'], // números monetários
      },
      borderRadius: { xl: '14px' },
    },
  },
  plugins: [],
} satisfies Config;
