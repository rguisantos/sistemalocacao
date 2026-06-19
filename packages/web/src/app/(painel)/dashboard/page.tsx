'use client';
import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { useApi } from '@/lib/swr';
import { useApi as useRotas } from '@/lib/swr';
import { formatarBRL } from '@/lib/format';
import { KpiCard, Cartao, Select, SkeletonCard, Badge, Tabela, Header, Botao } from '@/components/ui/primitives';
import { DollarSign, Users, Package, AlertTriangle, TrendingUp, TrendingDown, Receipt } from 'lucide-react';

const CORES_PIE = ['#C08A2D', '#11392B', '#1C5340', '#B4452F', '#6B7B72'];

interface DashboardData {
  faturamentoMes: number;
  faturamentoAnterior: number;
  variacao: number;
  inadimplencia: number;
  totalClientes: number;
  totalProdutos: number;
  locacoesAtivas: number;
  cobrancasAtrasadas: number;
  porRota: { rota: string; valor: number }[];
  faturamentoMensal: { mes: string; valor: number }[];
  statusDistribuicao: { status: string; total: number }[];
  topClientes: { id: string; nome: string; valor: number }[];
  cobrancasRecentes: { id: string; cliente: string; produto: string; valor: number; status: string; data: string }[];
}

const hoje = new Date().toISOString().slice(0, 10);
const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function Dashboard() {
  const [de, setDe] = useState(inicioMes);
  const [ate, setAte] = useState(hoje);
  const [rotaId, setRotaId] = useState('');

  const { data: d, isLoading, error } = useApi<DashboardData>(`/relatorios/dashboard?de=${de}&ate=${ate}${rotaId ? `&rotaId=${rotaId}` : ''}`);
  const { data: rotas } = useRotas<{ id: string; nome: string }[]>('/rotas');

  const periodoLabel = useMemo(() => {
    const d1 = new Date(de + 'T12:00:00');
    const d2 = new Date(ate + 'T12:00:00');
    return `${d1.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })} — ${d2.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}`;
  }, [de, ate]);

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <Header titulo="Painel" subtitulo={periodoLabel} />
        <Cartao className="p-8 text-center">
          <p className="text-alerta font-medium mb-2">Erro ao carregar dados do painel</p>
          <p className="text-suave text-sm mb-4">{error.message || 'Verifique suas permissões e tente novamente.'}</p>
          <Botao variante="secundario" onClick={() => window.location.reload()}>Tentar novamente</Botao>
        </Cartao>
      </div>
    );
  }

  if (isLoading || !d) {
    return (
      <div className="flex flex-col gap-6">
        <Header titulo="Painel" subtitulo={periodoLabel} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  const statusMap: Record<string, string> = { PENDENTE: 'Pendente', PAGO: 'Pago', PARCIAL: 'Parcial' };
  const statusBadge: Record<string, 'verde' | 'amarelo' | 'azul'> = { PAGO: 'verde', PARCIAL: 'amarelo', PENDENTE: 'azul' };

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Painel" subtitulo={periodoLabel} />

      {/* Filtros */}
      <Cartao className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-suave font-medium">Período</span>
          <div className="flex gap-2 items-center">
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)}
              className="border border-borda rounded-xl px-3 py-2 bg-white text-sm" />
            <span className="text-suave">até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)}
              className="border border-borda rounded-xl px-3 py-2 bg-white text-sm" />
          </div>
        </div>
        <Select value={rotaId} onChange={(e) => setRotaId(e.target.value)} className="sm:w-48">
          <option value="">Todas as rotas</option>
          {(rotas ?? []).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </Select>
        <div className="flex gap-1 flex-wrap">
          <PeriodoBotao label="Mês" onClick={() => { setDe(inicioMes); setAte(hoje); }} />
          <PeriodoBotao label="Trimestre" onClick={() => { const d = new Date(); d.setMonth(d.getMonth() - 3); setDe(d.toISOString().slice(0, 10)); setAte(hoje); }} />
          <PeriodoBotao label="Semestre" onClick={() => { const d = new Date(); d.setMonth(d.getMonth() - 6); setDe(d.toISOString().slice(0, 10)); setAte(hoje); }} />
          <PeriodoBotao label="Ano" onClick={() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); setDe(d.toISOString().slice(0, 10)); setAte(hoje); }} />
        </div>
      </Cartao>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="Faturamento" valor={formatarBRL(d.faturamentoMes)} icone={DollarSign} cor="latao"
          tendencia={d.variacao !== 0 ? { valor: Math.abs(d.variacao), positivo: d.variacao >= 0 } : undefined} />
        <KpiCard titulo="Inadimplência" valor={formatarBRL(d.inadimplencia)} icone={AlertTriangle} cor="alerta" />
        <KpiCard titulo="Locações ativas" valor={String(d.locacoesAtivas)} icone={Package} />
        <KpiCard titulo="Cobranças pendentes" valor={String(d.cobrancasAtrasadas)} icone={Receipt} />
      </div>

      {/* Gráficos: Faturamento mensal + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {d.faturamentoMensal && d.faturamentoMensal.length > 0 && (
          <Cartao>
            <h2 className="font-display font-semibold mb-4 text-sm">Faturamento mensal</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.faturamentoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E7E3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatarBRL(v)} />
                  <Bar dataKey="valor" fill="#C08A2D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Cartao>
        )}

        {d.statusDistribuicao && d.statusDistribuicao.length > 0 && (
          <Cartao>
            <h2 className="font-display font-semibold mb-4 text-sm">Distribuição de status</h2>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.statusDistribuicao} dataKey="total" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, total }) => `${statusMap[status] || status}: ${total}`}>
                    {d.statusDistribuicao.map((_, i) => <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Cartao>
        )}
      </div>

      {/* Faturamento por rota + Top 5 clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {d.porRota && d.porRota.length > 0 && (
          <Cartao>
            <h2 className="font-display font-semibold mb-4 text-sm">Faturamento por rota</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.porRota} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E7E3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="rota" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v: number) => formatarBRL(v)} />
                  <Bar dataKey="valor" fill="#1C5340" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Cartao>
        )}

        {d.topClientes && d.topClientes.length > 0 && (
          <Cartao>
            <h2 className="font-display font-semibold mb-4 text-sm">Top 5 clientes</h2>
            <div className="flex flex-col gap-3">
              {d.topClientes.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-latao/10 text-latao text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <div className="w-full bg-papel rounded-full h-1.5 mt-1">
                      <div className="bg-latao h-1.5 rounded-full" style={{ width: `${(c.valor / (d.topClientes[0]?.valor || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <span className="valor text-sm font-medium flex-shrink-0">{formatarBRL(c.valor)}</span>
                </div>
              ))}
            </div>
          </Cartao>
        )}
      </div>

      {/* Cobranças recentes */}
      {d.cobrancasRecentes && d.cobrancasRecentes.length > 0 && (
        <Cartao>
          <h2 className="font-display font-semibold mb-4 text-sm">Cobranças recentes</h2>
          <Tabela colunas={['Cliente', 'Produto', 'Valor', 'Status']}>
            {d.cobrancasRecentes.map((c) => (
              <tr key={c.id} className="hover:bg-papel/50 transition">
                <td className="px-4 py-2.5 text-sm font-medium">{c.cliente}</td>
                <td className="px-4 py-2.5 text-sm text-suave">{c.produto}</td>
                <td className="px-4 py-2.5 text-sm valor">{formatarBRL(c.valor)}</td>
                <td className="px-4 py-2.5"><Badge var={statusBadge[c.status] || 'cinza'}>{statusMap[c.status] || c.status}</Badge></td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
      )}
    </div>
  );
}

function PeriodoBotao({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 rounded-lg border border-borda text-xs text-suave hover:bg-papel hover:text-tinta transition">
      {label}
    </button>
  );
}
