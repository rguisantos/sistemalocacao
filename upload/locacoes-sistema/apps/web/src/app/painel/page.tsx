'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatarBRL } from '@locacoes/shared';
import { TrendingUp, AlertCircle, FileText, CalendarClock, LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatsSkeleton } from '@/components/ui/Skeleton';
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

  if (isLoading) return <main className="mx-auto max-w-6xl p-8"><StatsSkeleton /></main>;
  if (error) return <p className="p-8 text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const temVencidas = (vencidas?.total ?? 0) > 0;

  return (
    <main className="mx-auto max-w-6xl p-8">
      <PageHeader icone={LayoutDashboard} titulo="Dashboard"
        descricao="Visão geral do mês: faturamento, inadimplência e operação" />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icone={TrendingUp} rotulo="Faturamento do mês" valor={formatarBRL(data.faturamentoMes)} />
        <StatCard icone={AlertCircle} rotulo="Inadimplência" valor={formatarBRL(data.inadimplencia)}
          tom={Number(data.inadimplencia) > 0 ? 'perigo' : 'padrao'} />
        <StatCard icone={FileText} rotulo="Locações ativas" valor={String(data.locacoesAtivas)} />
        <StatCard icone={CalendarClock} rotulo="Cobranças vencidas" valor={String(vencidas?.total ?? 0)}
          tom={temVencidas ? 'alerta' : 'padrao'}
          nota={Number(vencidas?.valorEstimadoTotal ?? 0) > 0
            ? `${formatarBRL(vencidas!.valorEstimadoTotal)} estimados`
            : undefined} />
      </div>

      <section className="mb-8 rounded-xl border bg-card p-5 shadow-sm">
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

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">Top cobradores do mês</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
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
