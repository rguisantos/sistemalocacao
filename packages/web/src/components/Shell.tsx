'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Package, Map, FileText, LogOut, UserCog, Route, Warehouse, Tags, Receipt, FileSignature, ScrollText, Settings, Menu, X, Bell, TrendingUp, AlertTriangle } from 'lucide-react';
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
  const { usuario, sair, pode } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    setLargura(window.innerWidth);
    const h = () => setLargura(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const isDesktop = largura >= 1024;

  // Fecha sidebar ao navegar (mobile)
  useEffect(() => { setAberto(false); }, [caminho]);

  const iniciais = usuario?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-papel">
      {/* ─── SIDEBAR (desktop: fixo, mobile: overlay) ─── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 w-64 bg-feltro text-papel/90 flex flex-col transition-transform duration-200',
        isDesktop ? 'translate-x-0' : aberto ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* Header do sidebar */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
          <div>
            <p className="font-display font-bold text-lg text-white">Locações</p>
          </div>
          {!isDesktop && (
            <button onClick={() => setAberto(false)} className="p-1.5 rounded-lg hover:bg-feltro-claro transition">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navegação */}
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

        {/* Footer do sidebar */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-latao/20 text-latao flex items-center justify-center text-xs font-bold flex-shrink-0">
              {iniciais}
            </div>
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

      {/* Overlay escuro no mobile */}
      {aberto && !isDesktop && (
        <div className="fixed inset-0 z-30 bg-tinta/50" onClick={() => setAberto(false)} />
      )}

      {/* ─── ÁREA PRINCIPAL ─── */}
      <div className={clsx('transition-all duration-200', isDesktop ? 'lg:ml-64' : '')}>
        {/* ─── TOPBAR ─── */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-borda">
          <div className="flex items-center justify-between h-14 px-4 lg:px-8">
            <div className="flex items-center gap-3">
              {!isDesktop && (
                <button onClick={() => setAberto(true)} className="p-2 -ml-2 rounded-lg hover:bg-papel transition">
                  <Menu size={20} className="text-tinta" />
                </button>
              )}
              <h2 className="text-sm font-medium text-suave hidden sm:block">
                {ITENS.find(i => caminho.startsWith(i.href))?.rotulo || 'Locações'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-papel transition relative">
                <Bell size={18} className="text-suave" />
              </button>
              {isDesktop && (
                <div className="flex items-center gap-2 pl-2 ml-2 border-l border-borda">
                  <div className="w-8 h-8 rounded-full bg-feltro/10 text-feltro flex items-center justify-center text-xs font-bold">
                    {iniciais}
                  </div>
                  <span className="text-sm font-medium text-tinta max-w-[120px] truncate">{usuario?.nome}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ─── CONTEÚDO ─── */}
        <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
