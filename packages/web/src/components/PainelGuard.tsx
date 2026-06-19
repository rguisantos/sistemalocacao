'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Shell } from '@/components/Shell';
import { Toaster } from '@/components/ui/primitives';

/** Consome o AuthProvider, protege as rotas do painel e renderiza o Shell. */
export function PainelGuard({ children }: { children: React.ReactNode }) {
  const { usuario, carregando, sair } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!carregando && !usuario) router.replace('/login');
  }, [carregando, usuario, router]);

  // Logout: chama API para revogar token, depois limpa local
  useEffect(() => {
    const origSair = sair;
    // Intercepta cliques de logout para chamar API
    const handleLogout = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('refresh') : null;
      if (token) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'https://sistemalocacao-api-production.up.railway.app'}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ refreshToken: token }),
        }).catch(() => {}); // Best-effort, não bloqueia logout
      }
    };
    window.addEventListener('logout-api', handleLogout);
    return () => window.removeEventListener('logout-api', handleLogout);
  }, [sair]);

  if (carregando || !usuario) return null;

  return (
    <>
      <Shell>{children}</Shell>
      <Toaster />
    </>
  );
}
