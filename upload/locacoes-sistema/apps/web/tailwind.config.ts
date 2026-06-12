import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        destructive: 'hsl(var(--destructive))',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
        },
        // Aliases legados: as páginas existentes seguem o tema sem alteração
        feltro: {
          DEFAULT: 'hsl(var(--primary))',
          escuro: '#0e3a24',
          claro: 'hsl(var(--primary) / 0.85)',
        },
        madeira: '#6d4c2f',
        giz: 'hsl(var(--background))',
      },
      borderColor: {
        DEFAULT: 'hsl(var(--border))', // `border`/`border-b` puros seguem o tema
      },
      borderRadius: {
        lg: 'var(--radius)',
      },
    },
  },
  plugins: [],
} satisfies Config;
