'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatarBRL } from '@locacoes/shared';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ResumoVencidas { total: number; valorEstimadoTotal: string }

interface Dashboard {
  faturamentoMes: string;
  inadimplencia: string;
  locacoesAtivas: number;
  topCobradores: { nome: string; cobrancas: number; total: string }[];
  faturamentoPorRota: { nome: string; total: string }[];
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Dashboard>('/api/relatorios/dashboard'),
  });
  const { data: vencidas } = useQuery({
    queryKey: ['vencidas-resumo'],
    queryFn: () => api<ResumoVencidas>('/api/relatorios/vencidas/resumo'),
  });

  if (isLoading) return <p className="p-8 text-stone-500">Carregando indicadores…</p>;
  if (error) return <p className="p-8 text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  const cards = [
    { titulo: 'Faturamento do mês', valor: formatarBRL(data.faturamentoMes) },
    { titulo: 'Inadimplência', valor: formatarBRL(data.inadimplencia) },
    { titulo: 'Locações ativas', valor: String(data.locacoesAtivas) },
    {
      titulo: 'Cobranças vencidas',
      valor: String(vencidas?.total ?? 0),
      destaque: (vencidas?.total ?? 0) > 0,
      extra: Number(vencidas?.valorEstimadoTotal ?? 0) > 0
        ? `${formatarBRL(vencidas!.valorEstimadoTotal)} estimados`
        : undefined,
    },
  ];

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="mb-6 text-2xl font-bold text-feltro">Dashboard</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c: any) => (
          <div key={c.titulo} className={`rounded-xl bg-white p-5 shadow-sm ${c.destaque ? 'ring-2 ring-amber-400' : ''}`}>
            <p className="text-sm text-stone-500">{c.titulo}</p>
            <p className={`mt-1 text-2xl font-bold ${c.destaque ? 'text-amber-600' : ''}`}>{c.valor}</p>
            {c.extra && <p className="text-xs text-stone-400">{c.extra}</p>}
          </div>
        ))}
      </div>

      <section className="mb-8 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">Faturamento por rota (mês corrente)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.faturamentoPorRota.map((r) => ({ ...r, total: Number(r.total) }))}>
              <XAxis dataKey="nome" />
              <YAxis />
              <Tooltip formatter={(v) => formatarBRL(Number(v))} />
              <Bar dataKey="total" fill="#1b5e3f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">Top cobradores do mês</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-stone-500">
              <th className="py-2">Cobrador</th>
              <th>Cobranças</th>
              <th className="text-right">Total recebido</th>
            </tr>
          </thead>
          <tbody>
            {data.topCobradores.map((c) => (
              <tr key={c.nome} className="border-b last:border-0">
                <td className="py-2">{c.nome}</td>
                <td>{c.cobrancas}</td>
                <td className="text-right font-medium">{formatarBRL(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
