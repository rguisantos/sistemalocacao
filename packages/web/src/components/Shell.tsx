'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Package, Map, FileText, LogOut, UserCog, Route,
  Warehouse, Tags, Receipt, FileSignature, ScrollText, Settings, Menu, X,
  Bell, TrendingUp, AlertTriangle, Search, Moon, Sun, Command,
} from 'lucide-react';
import { useApi } from '@/lib/swr';
import { useAuth } from '@/lib/auth';
import clsx from 'clsx';

const ITENS: { href: string; rotulo: string; icone: typeof LayoutDashboard; permissao?: string }[] = [
  { href: '/dashboard', rotulo: 'Painel', icone: LayoutDashboard },
  { href: '/clientes', rotulo: 'Clientes', icone: Users, permissao: 'clientes.ler' },
  { href: '/produtos', rotulo: 'Produtos', icone: Package, permissao: 'produtos.ler' },
  { href: '/locacoes', rotulo: 'Locações', icone: FileSignature, permissao: 'locacoes.ler' },
  { href: '/cobrancas', rotulo: 'Cobranças', icone: Receipt, permissao: 'cobrancas.ler' },
  { href: '/financeiro', rotulo: 'Financeiro', icone: TrendingUp, permissao: 'cobrancas.ler' },
  { href: '/saldos-devedores', rotulo: 'Saldos Devedores', icone: AlertTriangle, permissao: 'cobrancas.ler' },
  { href: '/usuarios', rotulo: 'Usuários', icone: UserCog, permissao: 'admin.usuarios.ler' },
  { href: '/rotas', rotulo: 'Rotas', icone: Route, permissao: 'rotas.ler' },
  { href: '/depositos', rotulo: 'Depósitos', icone: Warehouse, permissao: 'depositos.ler' },
  { href: '/tipos-produto', rotulo: 'Cadastros', icone: Tags, permissao: 'auxiliares.tipos.ler' },
  { href: '/mapa', rotulo: 'Mapa', icone: Map },
  { href: '/relatorios', rotulo: 'Relatórios', icone: FileText, permissao: 'relatorios.ler' },
  { href: '/auditoria', rotulo: 'Auditoria', icone: ScrollText, permissao: 'admin.auditoria.ler' },
  { href: '/configuracoes', rotulo: 'Configurações', icone: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const { usuario, sair, pode } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [largura, setLargura] = useState(0);

  // Dark mode
  const [escuro, setEscuro] = useState(false);
  useEffect(() => {
    const pref = localStorage.getItem('tema');
    const inicial = pref === 'escuro' || (!pref && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setEscuro(inicial);
    document.documentElement.classList.toggle('dark', inicial);
  }, []);
  function toggleTema() {
    const novo = !escuro;
    setEscuro(novo);
    localStorage.setItem('tema', novo ? 'escuro' : 'claro');
    document.documentElement.classList.toggle('dark', novo);
  }

  // Busca global
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const buscaRef = useRef<HTMLInputElement>(null);

  // Atalho Cmd+K / Ctrl+K
  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setBuscaAberta((v) => !v);
      }
      if (e.key === 'Escape') setBuscaAberta(false);
    }
    document.addEventListener('keydown', atalho);
    return () => document.removeEventListener('keydown', atalho);
  }, []);

  useEffect(() => { setBuscaAberta(false); setBusca(''); }, [caminho]);

  // Dados para busca
  const { data: clientes } = useApi<any[]>('/clientes');
  const { data: produtos } = useApi<any[]>('/produtos');

  const resultados = useMemo(() => {
    if (!busca || busca.length < 2) return [];
    const q = busca.toLowerCase();
    const res: { tipo: string; label: string; href: string; sub?: string }[] = [];

    // Menu items
    ITENS.filter(i => !i.permissao || pode(i.permissao)).forEach(i => {
      if (i.rotulo.toLowerCase().includes(q)) {
        res.push({ tipo: 'Página', label: i.rotulo, href: i.href });
      }
    });

    // Clientes
    (clientes ?? []).forEach((c: any) => {
      if (c.nome?.toLowerCase().includes(q) || c.cpfCnpj?.includes(q)) {
        res.push({ tipo: 'Cliente', label: c.nome, href: `/clientes/${c.id}`, sub: c.cpfCnpj });
      }
    });

    // Produtos
    (produtos ?? []).forEach((p: any) => {
      if (p.plaqueta?.toLowerCase().includes(q) || p.descricao?.toLowerCase().includes(q)) {
        res.push({ tipo: 'Produto', label: `${p.plaqueta} ${p.descricao ?? ''}`, href: '/produtos' });
      }
    });

    return res.slice(0, 12);
  }, [busca, clientes, produtos, pode]);

  useEffect(() => {
    if (buscaAberta && buscaRef.current) buscaRef.current.focus();
  }, [buscaAberta]);

  useEffect(() => {
    setLargura(window.innerWidth);
    const h = () => setLargura(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const isDesktop = largura >= 1024;
  useEffect(() => { setAberto(false); }, [caminho]);
  const iniciais = usuario?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-papel">
      {/* ─── SIDEBAR ─── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 w-64 bg-feltro text-papel/90 flex flex-col transition-transform duration-200',
        isDesktop ? 'translate-x-0' : aberto ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
          <p className="font-display font-bold text-lg text-white">Locações</p>
          {!isDesktop && (
            <button onClick={() => setAberto(false)} className="p-1.5 rounded-lg hover:bg-feltro-claro transition"><X size={18} /></button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <p className="px-3 text-xs text-papel/40 uppercase tracking-wider mb-2">Menu</p>
          {ITENS.filter((item) => !item.permissao || pode(item.permissao)).map(({ href, rotulo, icone: Icone }) => (
            <Link key={href} href={href}
              className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition mb-0.5',
                caminho.startsWith(href) ? 'bg-feltro-claro text-white font-medium' : 'hover:bg-feltro-claro/50')}>
              <Icone size={18} /> {rotulo}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          {/* Dark mode toggle */}
          <button onClick={toggleTema} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm hover:bg-feltro-claro/50 w-full transition text-papel/70 hover:text-white mb-1">
            {escuro ? <Sun size={18} /> : <Moon size={18} />} {escuro ? 'Modo claro' : 'Modo escuro'}
          </button>

          <div className="flex items-center gap-3 mt-2">
            <div className="w-9 h-9 rounded-full bg-latao/20 text-latao flex items-center justify-center text-xs font-bold flex-shrink-0">{iniciais}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{usuario?.nome}</p>
              <p className="text-xs text-papel/50 truncate">Administrador</p>
            </div>
          </div>
          <button onClick={sair} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm hover:bg-feltro-claro/50 mt-3 w-full transition text-papel/70 hover:text-white">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {aberto && !isDesktop && <div className="fixed inset-0 z-30 bg-tinta/50" onClick={() => setAberto(false)} />}

      {/* ─── ÁREA PRINCIPAL ─── */}
      <div className={clsx('transition-all duration-200', isDesktop ? 'lg:ml-64' : '')}>
        {/* ─── TOPBAR ─── */}
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-[#1a2b23]/80 backdrop-blur-md border-b border-borda">
          <div className="flex items-center justify-between h-14 px-4 lg:px-8">
            <div className="flex items-center gap-3">
              {!isDesktop && (
                <button onClick={() => setAberto(true)} className="p-2 -ml-2 rounded-lg hover:bg-papel transition"><Menu size={20} className="text-tinta" /></button>
              )}
              <h2 className="text-sm font-medium text-suave hidden sm:block">
                {ITENS.find(i => caminho.startsWith(i.href))?.rotulo || 'Locações'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Botão de busca */}
              <button onClick={() => setBuscaAberta(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-borda text-suave text-sm hover:bg-papel transition">
                <Search size={14} />
                <span className="hidden sm:inline">Buscar...</span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-papel border border-borda text-[10px] font-mono">
                  <Command size={10} />K
                </kbd>
              </button>

              {/* Dark mode toggle (topbar) */}
              <button onClick={toggleTema} className="p-2 rounded-lg hover:bg-papel transition">
                {escuro ? <Sun size={18} className="text-latao" /> : <Moon size={18} className="text-suave" />}
              </button>

              <button className="p-2 rounded-lg hover:bg-papel transition relative">
                <Bell size={18} className="text-suave" />
              </button>

              {isDesktop && (
                <div className="flex items-center gap-2 pl-2 ml-2 border-l border-borda">
                  <div className="w-8 h-8 rounded-full bg-feltro/10 text-feltro flex items-center justify-center text-xs font-bold">{iniciais}</div>
                  <span className="text-sm font-medium text-tinta max-w-[120px] truncate">{usuario?.nome}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">{children}</main>
      </div>

      {/* ─── BUSCA GLOBAL OVERLAY ─── */}
      {buscaAberta && (
        <div className="fixed inset-0 z-50 search-overlay bg-tinta/40" onClick={() => setBuscaAberta(false)}>
          <div className="max-w-xl mx-auto mt-20" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white dark:bg-[#1a2b23] rounded-2xl shadow-2xl border border-borda overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-borda">
                <Search size={18} className="text-suave flex-shrink-0" />
                <input
                  ref={buscaRef}
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar clientes, produtos, páginas..."
                  className="flex-1 bg-transparent text-tinta outline-none text-sm placeholder:text-suave"
                />
                <kbd className="px-2 py-0.5 rounded bg-papel border border-borda text-[10px] font-mono text-suave">ESC</kbd>
              </div>

              {resultados.length > 0 && (
                <div className="max-h-80 overflow-y-auto p-2">
                  {resultados.map((r, i) => (
                    <Link key={i} href={r.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-papel transition"
                      onClick={() => setBuscaAberta(false)}>
                      <span className="text-[10px] uppercase tracking-wider font-medium text-latao bg-latao/10 px-2 py-0.5 rounded-lg flex-shrink-0">{r.tipo}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-tinta truncate">{r.label}</p>
                        {r.sub && <p className="text-xs text-suave truncate">{r.sub}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {busca.length >= 2 && resultados.length === 0 && (
                <div className="px-4 py-8 text-center text-suave text-sm">Nenhum resultado para &quot;{busca}&quot;</div>
              )}

              {busca.length < 2 && (
                <div className="px-4 py-6 text-center text-suave text-sm">
                  <p>Digite ao menos 2 caracteres para buscar</p>
                  <p className="text-xs mt-1">Atalho: <kbd className="px-1 py-0.5 rounded bg-papel border border-borda text-[10px] font-mono">Cmd+K</kbd></p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
