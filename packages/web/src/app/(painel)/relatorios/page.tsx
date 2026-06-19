'use client';
import { useAuth } from '@/lib/auth';
import { Header, Cartao } from '@/components/ui/primitives';
import { DollarSign, Package, Users, Map, BarChart3, GitCompare } from 'lucide-react';
import Link from 'next/link';

const CATEGORIAS = [
  { id: 'financeiro', titulo: 'Financeiro', descricao: 'Faturamento, recebimentos e inadimplência', icone: DollarSign, cor: 'bg-latao/10 text-latao', href: '/relatorios/financeiro' },
  { id: 'locacoes', titulo: 'Locações', descricao: 'Locações ativas e finalizadas por período', icone: Package, cor: 'bg-feltro/5 text-feltro', href: '/relatorios/locacoes' },
  { id: 'produtos', titulo: 'Produtos', descricao: 'Produtos locados, estoque e tipos', icone: BarChart3, cor: 'bg-blue-50 text-blue-600', href: '/relatorios/produtos' },
  { id: 'clientes', titulo: 'Clientes e Rotas', descricao: 'Distribuição de clientes por rota', icone: Users, cor: 'bg-purple-50 text-purple-600', href: '/relatorios/clientes' },
  { id: 'recebimentos', titulo: 'Recebimentos', descricao: 'Recebimentos por forma de pagamento', icone: Map, cor: 'bg-emerald-50 text-emerald-600', href: '/relatorios/recebimentos' },
  { id: 'comparativo', titulo: 'Comparativo', descricao: 'Comparação período a período', icone: GitCompare, cor: 'bg-amber-50 text-amber-600', href: '/relatorios/comparativo' },
];

export default function RelatoriosHub() {
  const { pode } = useAuth();

  if (!pode('relatorios.ler')) {
    return (
      <div className="flex flex-col gap-6">
        <Header titulo="Relatórios" />
        <Cartao className="text-suave text-center py-12">
          <BarChart3 size={48} className="mx-auto mb-3 text-suave/30" />
          <p className="font-medium">Você não tem permissão para acessar relatórios.</p>
        </Cartao>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Relatórios" subtitulo="Selecione uma categoria para ver os dados detalhados" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIAS.map((cat) => (
          <Link key={cat.id} href={cat.href}>
            <Cartao hover className="flex items-start gap-4 h-full cursor-pointer">
              <div className={`p-3 rounded-xl flex-shrink-0 ${cat.cor}`}>
                <cat.icone size={24} />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm">{cat.titulo}</h3>
                <p className="text-suave text-xs mt-1">{cat.descricao}</p>
              </div>
            </Cartao>
          </Link>
        ))}
      </div>

      {/* Atalho rápido para inadimplência */}
      <Link href="/relatorios/financeiro">
        <Cartao hover className="flex items-center gap-4 cursor-pointer border-l-4 border-l-alerta">
          <AlertTriangle size={24} className="text-alerta" />
          <div>
            <h3 className="font-display font-semibold text-sm">Inadimplência</h3>
            <p className="text-suave text-xs">Veja clientes com saldos devedores e cobranças pendentes</p>
          </div>
        </Cartao>
      </Link>
    </div>
  );
}

function AlertTriangle(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;
}
