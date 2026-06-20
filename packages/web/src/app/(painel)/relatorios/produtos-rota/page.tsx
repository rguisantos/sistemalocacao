'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPinned, Package } from 'lucide-react';
import { useApi } from '@/lib/swr';
import { useAuth } from '@/lib/auth';
import { Header, Cartao, Select, Botao, Badge, SkeletonCard, EmptyState } from '@/components/ui/primitives';

const REGRA_LABEL: Record<string, string> = { VALOR_FIXO: 'Valor Fixo', PERCENTUAL_A_RECEBER: '% a Receber', PERCENTUAL_A_PAGAR: '% a Pagar' };

export default function ProdutosPorRotaPage() {
  const { pode } = useAuth();
  const [rotaId, setRotaId] = useState('');
  const { data: rotas } = useApi<any[]>('/rotas');
  const { data, isLoading } = useApi<any>('/relatorios/produtos-por-rota' + (rotaId ? `?rotaId=${rotaId}` : ''));

  if (!pode('relatorios.ler')) {
    return <div className="flex flex-col gap-6"><Header titulo="Produtos por rota" /><Cartao className="text-center text-suave py-12">Sem permissão para acessar relatórios.</Cartao></div>;
  }

  const grupos: any[] = data?.porRota ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/relatorios"><Botao variante="fantasma" tamanho="sm" icon={ArrowLeft}>Voltar</Botao></Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">Produtos por rota</h1>
          <p className="text-suave text-sm">Equipamentos em locação ativa, agrupados pela rota do cliente</p>
        </div>
        <Select value={rotaId} onChange={(e) => setRotaId(e.target.value)} className="sm:w-52">
          <option value="">Todas as rotas</option>
          {(rotas ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4">{[1, 2].map((i) => <SkeletonCard key={i} />)}</div>
      ) : grupos.length === 0 ? (
        <EmptyState icone={<Package size={48} />} titulo="Nenhum produto em locação ativa" descricao="Não há equipamentos locados para os filtros selecionados." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Cartao className="p-4"><p className="text-xs text-suave uppercase tracking-wide">Produtos locados</p><p className="text-2xl font-bold valor">{data?.totalProdutos ?? 0}</p></Cartao>
            <Cartao className="p-4"><p className="text-xs text-suave uppercase tracking-wide">Rotas com locação</p><p className="text-2xl font-bold">{data?.totalRotas ?? 0}</p></Cartao>
          </div>

          {grupos.map((g) => (
            <Cartao key={g.rotaId} className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-papel/60 border-b border-borda">
                <div className="flex items-center gap-2">
                  <MapPinned size={16} className="text-latao" />
                  <span className="font-medium">{g.rota}</span>
                </div>
                <Badge var="cinza">{g.itens.length} produto{g.itens.length !== 1 ? 's' : ''}</Badge>
              </div>
              <div className="divide-y divide-borda">
                {g.itens.map((it: any) => (
                  <div key={it.locacaoId} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/locacoes/${it.locacaoId}`} className="text-sm font-medium valor text-feltro hover:text-latao transition">{it.plaqueta}</Link>
                        {it.descricao && <span className="text-xs text-suave">{it.descricao}</span>}
                        <Badge var="azul">{REGRA_LABEL[it.regra] ?? it.regra}</Badge>
                      </div>
                      <p className="text-sm mt-0.5">
                        {it.clienteId ? <Link href={`/clientes/${it.clienteId}`} className="hover:text-feltro transition">{it.cliente}</Link> : it.cliente}
                      </p>
                      {it.endereco && <p className="text-xs text-suave truncate">{it.endereco}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Cartao>
          ))}
        </>
      )}
    </div>
  );
}
