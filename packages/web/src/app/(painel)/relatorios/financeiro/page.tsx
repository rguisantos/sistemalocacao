'use client';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { useApi } from '@/lib/swr';
import { formatarBRL } from '@/lib/format';
import { Cartao, Select, Tabela, Badge, Header, KpiCard, SkeletonCard, SkeletonTable } from '@/components/ui/primitives';
import { DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const hoje = new Date().toISOString().slice(0, 10);
const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function RelatorioFinanceiro() {
  const [de, setDe] = useState(inicioMes);
  const [ate, setAte] = useState(hoje);
  const [rotaId, setRotaId] = useState('');

  const { data: d, isLoading: ld } = useApi<any>(`/relatorios/dashboard?de=${de}&ate=${ate}${rotaId ? `&rotaId=${rotaId}` : ''}`);
  const { data: inad, isLoading: li } = useApi<any[]>('/relatorios/inadimplencia');
  const { data: rotas } = useApi<any[]>('/rotas');

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Relatório Financeiro" subtitulo="Faturamento, inadimplência e recebimentos"
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

      {ld ? <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div> : d && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard titulo="Faturamento no período" valor={formatarBRL(d.faturamentoMes)} icone={DollarSign} cor="latao" />
          <KpiCard titulo="Inadimplência total" valor={formatarBRL(d.inadimplencia)} icone={AlertTriangle} cor="alerta" />
          <KpiCard titulo="Variação" valor={`${d.variacao >= 0 ? '+' : ''}${d.variacao}%`} icone={d.variacao >= 0 ? TrendingUp : AlertTriangle} cor={d.variacao >= 0 ? 'latao' : 'alerta'} />
        </div>
      )}

      {ld ? <SkeletonTable /> : d?.porRota && d.porRota.length > 0 && (
        <Cartao>
          <h2 className="font-display font-semibold mb-4">Faturamento por rota</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.porRota}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E7E3" />
                <XAxis dataKey="rota" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatarBRL(v)} />
                <Bar dataKey="valor" fill="#C08A2D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
      )}

      {li ? <SkeletonTable /> : (
        <div>
          <h2 className="font-display font-semibold mb-2">Inadimplência</h2>
          <Tabela colunas={['Cliente', 'Origem', 'Valor']} vazio="Nenhuma inadimplência encontrada.">
            {(inad ?? []).map((i: any, k: number) => (
              <tr key={k} className="hover:bg-papel/50 transition">
                <td className="px-4 py-3 font-medium">{i.cliente}</td>
                <td className="px-4 py-3 text-suave">{i.origem}</td>
                <td className="px-4 py-3 valor">{formatarBRL(i.valor)}</td>
              </tr>
            ))}
          </Tabela>
        </div>
      )}
    </div>
  );
}
