'use client';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { useApi } from '@/lib/swr';
import { formatarBRL } from '@/lib/format';
import { Cartao, Select, Header, SkeletonCard, Tabela, Badge } from '@/components/ui/primitives';
import Link from 'next/link';

const hoje = new Date().toISOString().slice(0, 10);
const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function RelatorioRecebimentos() {
  const [de, setDe] = useState(inicioMes);
  const [ate, setAte] = useState(hoje);
  const [rotaId, setRotaId] = useState('');

  const { data: d, isLoading } = useApi<any[]>(`/relatorios/recebimentos?de=${de}&ate=${ate}${rotaId ? `&rotaId=${rotaId}` : ''}`);
  const { data: rotas } = useApi<any[]>('/rotas');

  const formaMap: Record<string, string> = {
    DINHEIRO: 'Dinheiro', PIX_MANUAL: 'PIX Manual', CARTAO: 'Cartão', PIX_MERCADO_PAGO: 'PIX Mercado Pago',
  };
  const formaBadge: Record<string, 'verde' | 'azul' | 'amarelo' | 'roxo'> = {
    DINHEIRO: 'verde', PIX_MANUAL: 'azul', CARTAO: 'amarelo', PIX_MERCADO_PAGO: 'roxo',
  };

  const total = d?.reduce((s: number, p: any) => s + p.total, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Recebimentos" subtitulo="Recebimentos por forma de pagamento"
        acoes={<Link href="/relatorios" className="text-sm text-suave hover:text-tinta transition">← Voltar</Link>} />

      <Cartao className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-suave font-medium">Período</span>
          <div className="flex gap-2 items-center">
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="border border-borda rounded-xl px-3 py-2 bg-white text-sm" />
            <span className="text-suave">até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="border border-borda rounded-xl px-3 py-2 bg-white text-sm" />
          </div>
        </div>
        <Select value={rotaId} onChange={(e) => setRotaId(e.target.value)} className="sm:w-48">
          <option value="">Todas as rotas</option>
          {(rotas ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </Select>
      </Cartao>

      {isLoading ? <SkeletonCard /> : (
        <>
          <Cartao className="text-center">
            <p className="text-suave text-sm">Total recebido no período</p>
            <p className="text-3xl font-bold text-latao mt-2 valor">{formatarBRL(total)}</p>
          </Cartao>

          {d && d.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Cartao>
                <h2 className="font-display font-semibold mb-4">Por forma de pagamento</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.map((p: any) => ({ ...p, forma: formaMap[p.forma] || p.forma }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3E7E3" />
                      <XAxis dataKey="forma" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => formatarBRL(v)} />
                      <Bar dataKey="total" fill="#1C5340" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Cartao>
              <Cartao>
                <h2 className="font-display font-semibold mb-4">Detalhamento</h2>
                <Tabela colunas={['Forma', 'Quantidade', 'Total']}>
                  {d.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-papel/50 transition">
                      <td className="px-4 py-3"><Badge var={formaBadge[p.forma] || 'cinza'}>{formaMap[p.forma] || p.forma}</Badge></td>
                      <td className="px-4 py-3">{p.quantidade} pagamento{p.quantidade !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-3 valor font-medium">{formatarBRL(p.total)}</td>
                    </tr>
                  ))}
                </Tabela>
              </Cartao>
            </div>
          )}
        </>
      )}
    </div>
  );
}
