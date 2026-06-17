import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Locações e Cobranças', description: 'Painel administrativo' };

// Layout raiz mínimo: NÃO monta o AuthProvider aqui, para que as páginas de erro internas
// (/404 e /500, prerenderizadas no build) não tentem usar contexto/cliente em SSR.
// O provider fica nas subárvores que precisam (login e painel).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
