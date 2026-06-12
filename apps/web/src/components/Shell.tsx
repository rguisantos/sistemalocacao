'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { LogOut, Sun, Moon, Command } from 'lucide-react';
import { GRUPOS_NAV } from '@/lib/navegacao';
import { CommandPalette } from '@/components/CommandPalette';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { PERMISSOES } from '@locacoes/shared';

function ToggleTema() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return <div className="h-8 w-8" />; // evita mismatch de hidratação
  const escuro = resolvedTheme === 'dark';
  return (
    <button
      onClick={() => setTheme(escuro ? 'light' : 'dark')}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
      className="grid h-8 w-8 place-items-center rounded-lg text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
    >
      {escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

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

  const badge = (href: string) => {
    if (href === '/painel/conflitos' && (stats?.pendentes ?? 0) > 0) {
      return <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">{stats!.pendentes}</span>;
    }
    if (href === '/painel/vencidas' && (vencidas?.total ?? 0) > 0) {
      return <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{vencidas!.total}</span>;
    }
    return null;
  };

  if (!pronto) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Restaurando sessão…</p>
      </div>
    );
  }

  const inicial = (usuario?.nome ?? '?').trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground print:hidden">
        {/* Marca */}
        <div className="flex items-center gap-3 border-b p-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-base font-black text-primary-foreground">
            L
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Locações</p>
            <p className="text-xs text-muted-foreground">Painel administrativo</p>
          </div>
        </div>

        {/* Navegação em grupos */}
        <nav className="flex-1 overflow-y-auto p-3">
          {GRUPOS_NAV.map((g) => {
            const visiveis = g.itens.filter((m) => !m.perm || temPermissao(m.perm));
            if (visiveis.length === 0) return null;
            return (
              <div key={g.titulo} className="mb-4">
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.titulo}
                </p>
                {visiveis.map((m) => {
                  const ativo = pathname === m.href;
                  const Icone = m.icone;
                  return (
                    <Link
                      key={m.href}
                      href={m.href}
                      className={`group relative mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                        ativo
                          ? 'bg-sidebar-accent font-semibold text-primary'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                      }`}
                    >
                      {ativo && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-primary" />}
                      <Icone className={`h-4 w-4 shrink-0 ${ativo ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'}`} />
                      <span className="flex-1">{m.rotulo}</span>
                      {badge(m.href)}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Atalho da paleta de comandos */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="mx-3 mb-2 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground transition hover:bg-sidebar-accent"
        >
          <Command className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Buscar e navegar</span>
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
        </button>

        {/* Rodapé: usuário + tema + sair */}
        <div className="flex items-center gap-2 border-t p-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {inicial}
          </div>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{usuario?.nome}</p>
          <ToggleTema />
          <button
            onClick={() => { logout(); router.push('/login'); }}
            title="Sair"
            className="grid h-8 w-8 place-items-center rounded-lg text-sidebar-foreground/70 transition hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-background">{children}</main>
      <CommandPalette />
    </div>
  );
}
