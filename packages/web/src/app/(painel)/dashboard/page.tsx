'use client';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useApi } from '@/lib/swr';
import { formatarBRL } from '@/lib/format';
import { KpiCard, SkeletonCard, Cartao } from '@/components/ui/primitives';
import { DollarSign, Users, Package, AlertTriangle } from 'lucide-react';

interface Dados {
  faturamentoMes: number;
  inadimplencia: number;
  locacoesAtivas: number;
  porRota: { rota: string; valor: number }[];
}

export default function Dashboard() {
  const { data: d, isLoading } = useApi<Dados>('/relatorios/dashboard');

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-bold">Painel</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  if (!d) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-bold">Painel</h1>
        <Cartao className="text-suave">Os relatórios consolidados não estão disponíveis no momento. Tente novamente mais tarde.</Cartao>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Painel</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="Faturamento do mês" valor={formatarBRL(d.faturamentoMes)} icone={DollarSign} cor="latao" />
        <KpiCard titulo="Inadimplência" valor={formatarBRL(d.inadimplencia)} icone={AlertTriangle} cor="alerta" />
        <KpiCard titulo="Locações ativas" valor={String(d.locacoesAtivas)} icone={Package} />
        <KpiCard titulo="Total de rotas" valor={String(d.porRota?.length ?? 0)} icone={Users} />
      </div>

      {/* Gráfico */}
      {d.porRota && d.porRota.length > 0 && (
        <Cartao>
          <h2 className="font-display font-semibold mb-4">Faturamento por rota</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.porRota}>
                <XAxis dataKey="rota" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatarBRL(v)} />
                <Bar dataKey="valor" fill="#C08A2D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
      )}
    </div>
  );
}
