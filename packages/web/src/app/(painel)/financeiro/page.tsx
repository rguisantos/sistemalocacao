'use client';
import { useState } from 'react';
import { useApi } from '@/lib/swr';
import { formatarBRL, data as fmtData } from '@/lib/format';
import {
  Botao, Campo, Select, Cartao, Header, KpiCard, SkeletonCard,
} from '@/components/ui/primitives';
import {
  TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle2, BarChart3,
  Filter, PieChart as PieIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function FinanceiroPage() {
  const [clienteId, setClienteId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const { data: clientes } = useApi<any[]>('/clientes');
  const { data: resumo, isLoading } = useApi<any>(
    `/cobrancas/resumo?${new URLSearchParams(Object.entries({ clienteId, dataInicio, dataFim }).filter(([, v]) => v)).toString()}`
  );

  const totais = resumo?.totais ?? {};
  const porForma = resumo?.porForma ?? [];
  const evolucaoMensal = resumo?.evolucaoMensal ?? [];

  // Dados para o gráfico de barras
  const chartData = evolucaoMensal.map((m: any) => ({
    mes: m.mes.slice(5) + '/' + m.mes.slice(2, 4),
    Cobrado: Number(m.cobrado),
    Recebido: Number(m.recebido),
  }));

  // Dados para o gráfico de pizza (forma de pagamento)
  const formaChartData = porForma.map((f: any) => ({
    name: f.forma?.replace(/_/g, ' '),
    value: Number(f.valor),
    count: f.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Histórico Financeiro" subtitulo="Acompanhe receitas, pagamentos e evolução financeira" />

      {/* Filtros */}
      <Cartao className="flex flex-wrap items-end gap-4">
        <Select label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Todos</option>
          {(clientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        <Campo label="Data início" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        <Campo label="Data fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        <Botao variante="fantasma" tamanho="sm" onClick={() => { setClienteId(''); setDataInicio(''); setDataFim(''); }}>Limpar</Botao>
      </Cartao>

      {isLoading ? (
        <div className="grid gap-4">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total pendente" valor={formatarBRL(totais.pendente?.valor ?? 0)} icone={Clock} cor="amber" subtitulo={`${totais.pendente?.count ?? 0} cobranças`} />
            <KpiCard label="Total parcial" valor={formatarBRL(totais.parcial?.valor ?? 0)} icone={TrendingDown} cor="blue" subtitulo={`${totais.parcial?.count ?? 0} cobranças`} />
            <KpiCard label="Total pago" valor={formatarBRL(totais.pago?.valor ?? 0)} icone={CheckCircle2} cor="emerald" subtitulo={`${totais.pago?.count ?? 0} cobranças`} />
            <KpiCard label="Total recebido" valor={formatarBRL(totais.totalRecebido ?? 0)} icone={DollarSign} cor="violet" />
          </div>

          {/* Gráficos */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Evolução mensal */}
            <Cartao className="lg:col-span-2 p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-latao" />
                <h3 className="font-semibold">Evolução mensal (Cobrado × Recebido)</h3>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatarBRL(v)} />
                    <Legend />
                    <Bar dataKey="Cobrado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Recebido" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-suave py-12">Sem dados para o período selecionado.</p>
              )}
            </Cartao>

            {/* Pizza: forma de pagamento */}
            <Cartao className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <PieIcon size={18} className="text-latao" />
                <h3 className="font-semibold">Por forma de pagamento</h3>
              </div>
              {formaChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={formaChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {formaChartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatarBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-suave py-12">Sem pagamentos no período.</p>
              )}
            </Cartao>
          </div>

          {/* Detalhamento por forma */}
          {formaChartData.length > 0 && (
            <Cartao className="p-4">
              <h3 className="font-semibold mb-4">Detalhamento por forma de pagamento</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-borda">
                      <th className="text-left px-4 py-2 text-suave font-medium">Forma</th>
                      <th className="text-right px-4 py-2 text-suave font-medium">Valor total</th>
                      <th className="text-right px-4 py-2 text-suave font-medium">Pagamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formaChartData.map((f: any, i: number) => (
                      <tr key={i} className="border-b border-borda last:border-0 hover:bg-papel/50">
                        <td className="px-4 py-2.5 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          {f.name}
                        </td>
                        <td className="px-4 py-2.5 text-right valor">{formatarBRL(f.value)}</td>
                        <td className="px-4 py-2.5 text-right">{f.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Cartao>
          )}
        </>
      )}
    </div>
  );
}
