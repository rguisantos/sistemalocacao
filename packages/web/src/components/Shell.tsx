'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Package, Map, FileText, LogOut, UserCog, Route, Warehouse, Tags, Receipt, FileSignature, ScrollText, Settings } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import clsx from 'clsx';

const ITENS: { href: string; rotulo: string; icone: typeof LayoutDashboard; permissao?: string }[] = [
  { href: '/dashboard', rotulo: 'Painel', icone: LayoutDashboard },
  { href: '/clientes', rotulo: 'Clientes', icone: Users, permissao: 'clientes.ler' },
  { href: '/produtos', rotulo: 'Produtos', icone: Package, permissao: 'produtos.ler' },
  { href: '/locacoes', rotulo: 'Locações', icone: FileSignature, permissao: 'locacoes.ler' },
  { href: '/cobrancas', rotulo: 'Cobrança', icone: Receipt, permissao: 'cobrancas.ler' },
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
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="bg-feltro text-papel/90 flex flex-col p-4">
        <div className="px-2 py-3 mb-4">
          <p className="font-display font-bold text-lg text-white">Locações</p>
          <p className="text-papel/60 text-xs">{usuario?.nome}</p>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {ITENS.filter((item) => !item.permissao || pode(item.permissao)).map(({ href, rotulo, icone: Icone }) => (
            <Link key={href} href={href}
              className={clsx('flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition',
                caminho.startsWith(href) ? 'bg-feltro-claro text-white' : 'hover:bg-feltro-claro/50')}>
              <Icone size={18} /> {rotulo}
            </Link>
          ))}
        </nav>
        <button onClick={sair} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm hover:bg-feltro-claro/50">
          <LogOut size={18} /> Sair
        </button>
      </aside>
      <main className="p-8 overflow-auto">{children}</main>
    </div>
  );
}
