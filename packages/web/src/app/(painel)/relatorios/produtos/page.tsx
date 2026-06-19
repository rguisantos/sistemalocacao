'use client';
import { useApi } from '@/lib/swr';
import { Cartao, Tabela, Badge, Header, SkeletonCard } from '@/components/ui/primitives';
import Link from 'next/link';

export default function RelatorioProdutos() {
  const { data: d, isLoading } = useApi<any>('/relatorios/produtos');

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Relatório de Produtos" subtitulo="Produtos locados, disponíveis e por tipo"
        acoes={<Link href="/relatorios" className="text-sm text-suave hover:text-tinta transition">← Voltar</Link>} />

      {isLoading ? <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div> : d && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Cartao className="text-center">
              <p className="text-suave text-sm">Total de produtos</p>
              <p className="text-3xl font-bold text-tinta mt-2">{d.total}</p>
            </Cartao>
            <Cartao className="text-center">
              <p className="text-suave text-sm">Produtos locados</p>
              <p className="text-3xl font-bold text-latao mt-2">{d.locados}</p>
            </Cartao>
            <Cartao className="text-center">
              <p className="text-suave text-sm">Disponíveis</p>
              <p className="text-3xl font-bold text-feltro mt-2">{d.disponiveis}</p>
            </Cartao>
          </div>

          {d.porTipo && d.porTipo.length > 0 && (
            <Cartao>
              <h2 className="font-display font-semibold mb-4">Distribuição por tipo</h2>
              <Tabela colunas={['Tipo', 'Quantidade']}>
                {d.porTipo.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-papel/50 transition">
                    <td className="px-4 py-3"><Badge var="azul">{p.tipo}</Badge></td>
                    <td className="px-4 py-3 font-medium">{p.total}</td>
                  </tr>
                ))}
              </Tabela>
            </Cartao>
          )}
        </>
      )}
    </div>
  );
}
