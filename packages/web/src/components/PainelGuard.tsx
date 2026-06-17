'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Shell } from '@/components/Shell';

/** Consome o AuthProvider, protege as rotas do painel e renderiza o Shell. */
export function PainelGuard({ children }: { children: React.ReactNode }) {
  const { usuario, carregando } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!carregando && !usuario) router.replace('/login'); }, [carregando, usuario, router]);
  if (carregando || !usuario) return null;
  return <Shell>{children}</Shell>;
}
