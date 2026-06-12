'use client';
// Paleta de comandos (Ctrl+K / ⌘K): navegação e ações rápidas.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Search, Sun, Moon, LogOut, CornerDownLeft } from 'lucide-react';
import { GRUPOS_NAV } from '@/lib/navegacao';
import { useAuth } from '@/store/auth';

interface Comando {
  id: string;
  rotulo: string;
  grupo: string;
  icone: React.ComponentType<{ className?: string }>;
  executar: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { logout, temPermissao } = useAuth();
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const [indice, setIndice] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho global Ctrl+K / ⌘K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAberta((a) => !a);
      }
      if (e.key === 'Escape') setAberta(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (aberta) {
      setBusca(''); setIndice(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [aberta]);

  const comandos = useMemo<Comando[]>(() => {
    const nav: Comando[] = GRUPOS_NAV.flatMap((g) =>
      g.itens
        .filter((i) => !i.perm || temPermissao(i.perm))
        .map((i) => ({
          id: i.href,
          rotulo: i.rotulo,
          grupo: g.titulo,
          icone: i.icone,
          executar: () => router.push(i.href),
        }))
    );
    const acoes: Comando[] = [
      {
        id: 'tema',
        rotulo: resolvedTheme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro',
        grupo: 'Ações',
        icone: resolvedTheme === 'dark' ? Sun : Moon,
        executar: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
      },
      { id: 'sair', rotulo: 'Sair da conta', grupo: 'Ações', icone: LogOut,
        executar: () => { logout(); router.push('/login'); } },
    ];
    return [...nav, ...acoes];
  }, [router, resolvedTheme, setTheme, logout, temPermissao]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return comandos;
    return comandos.filter((c) => c.rotulo.toLowerCase().includes(q) || c.grupo.toLowerCase().includes(q));
  }, [busca, comandos]);

  useEffect(() => setIndice(0), [busca]);

  function executar(c: Comando) {
    setAberta(false);
    c.executar();
  }

  function onTeclas(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndice((i) => Math.min(i + 1, filtrados.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndice((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtrados[indice]) { e.preventDefault(); executar(filtrados[indice]); }
  }

  if (!aberta) return null;

  let grupoAnterior = '';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setAberta(false)} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={onTeclas}
            placeholder="Ir para… ou executar ação"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtrados.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nada encontrado para “{busca}”.</p>
          )}
          {filtrados.map((c, i) => {
            const Icone = c.icone;
            const cabecalho = c.grupo !== grupoAnterior ? c.grupo : null;
            grupoAnterior = c.grupo;
            return (
              <div key={c.id}>
                {cabecalho && (
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cabecalho}
                  </p>
                )}
                <button
                  onMouseEnter={() => setIndice(i)}
                  onClick={() => executar(c)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                    i === indice ? 'bg-primary/10 text-primary' : 'text-foreground/80'
                  }`}
                >
                  <Icone className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{c.rotulo}</span>
                  {i === indice && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
