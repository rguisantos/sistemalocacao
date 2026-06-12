'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { PERMISSOES } from '@locacoes/shared';

const MENU = [
  { href: '/painel', rotulo: 'Dashboard', perm: PERMISSOES.VISUALIZAR_RELATORIOS },
  { href: '/painel/clientes', rotulo: 'Clientes', perm: null },
  { href: '/painel/locacoes', rotulo: 'Locações', perm: null },
  { href: '/painel/vencidas', rotulo: 'Vencidas', perm: null },
  { href: '/painel/saldos', rotulo: 'Saldos Devedores', perm: null },
  { href: '/painel/relatorios', rotulo: 'Relatórios', perm: PERMISSOES.VISUALIZAR_RELATORIOS },
  { href: '/painel/produtos', rotulo: 'Produtos', perm: null },
  { href: '/painel/cadastros', rotulo: 'Rotas e Depósitos', perm: null },
  { href: '/painel/usuarios', rotulo: 'Usuários', perm: PERMISSOES.GERENCIAR_USUARIOS },
  { href: '/painel/integracoes', rotulo: 'Integrações', perm: PERMISSOES.GERENCIAR_INTEGRACOES_PAGAMENTO },
  { href: '/painel/conflitos', rotulo: 'Conflitos de Sync', perm: PERMISSOES.VISUALIZAR_LOGS_AUDITORIA },
  { href: '/painel/auditoria', rotulo: 'Auditoria', perm: PERMISSOES.VISUALIZAR_LOGS_AUDITORIA },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { usuario, logout, temPermissao, restaurar } = useAuth();
  const [pronto, setPronto] = useState(false);

  // Guard: após reload, tenta restaurar a sessão pelo refreshToken;
  // sem sessão válida, volta para o login.
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (usuario) { setPronto(true); return; }
      const restaurado = await restaurar();
      if (!ativo) return;
      if (!restaurado) { router.replace('/login'); return; }
      setPronto(true);
    })();
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: vencidas } = useQuery({
    queryKey: ['vencidas-resumo'],
    queryFn: () => api<{ total: number }>('/api/relatorios/vencidas/resumo'),
    refetchInterval: 5 * 60_000,
    enabled: !!usuario,
  });

  const { data: stats } = useQuery({
    queryKey: ['conflitos-stats'],
    queryFn: () => api<{ pendentes: number }>('/api/conflitos/estatisticas'),
    refetchInterval: 60_000,
    enabled: !!usuario && temPermissao(PERMISSOES.VISUALIZAR_LOGS_AUDITORIA),
  });

  if (!pronto) {
    return (
      <div className="grid min-h-screen place-items-center bg-giz">
        <p className="text-sm text-stone-400">Restaurando sessão…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-feltro text-white print:hidden">
        <div className="border-b border-white/10 p-5">
          <p className="text-lg font-bold">Locações</p>
          <p className="text-xs text-white/60">{usuario?.nome ?? 'Painel administrativo'}</p>
        </div>
        <nav className="p-3">
          {MENU.filter((m) => !m.perm || temPermissao(m.perm)).map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`mb-1 flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                pathname === m.href ? 'bg-white/15 font-semibold' : 'hover:bg-white/10'
              }`}
            >
              {m.rotulo}
              {m.href === '/painel/conflitos' && (stats?.pendentes ?? 0) > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold">
                  {stats!.pendentes}
                </span>
              )}
              {m.href === '/painel/vencidas' && (vencidas?.total ?? 0) > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold">
                  {vencidas!.total}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => { logout(); router.push('/login'); }}
          className="mx-3 mt-4 w-[calc(100%-1.5rem)] rounded-lg border border-white/20 px-3 py-2 text-left text-sm hover:bg-white/10"
        >
          Sair
        </button>
      </aside>
      <main className="flex-1 bg-giz">{children}</main>
    </div>
  );
}
