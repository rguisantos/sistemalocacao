'use client';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { useApi } from '@/lib/swr';
import { Cartao, Select, Header, SkeletonCard, Badge } from '@/components/ui/primitives';
import { formatarBRL } from '@/lib/format';
import Link from 'next/link';

const CORES = ['#1C5340', '#C08A2D', '#B4452F'];

export default function RelatorioLocacoes() {
  const [rotaId, setRotaId] = useState('');
  const { data: d, isLoading } = useApi<any>(`/relatorios/locacoes${rotaId ? `?rotaId=${rotaId}` : ''}`);
  const { data: rotas } = useApi<any[]>('/rotas');

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Relatório de Locações" subtitulo="Locações ativas e finalizadas"
        acoes={<Link href="/relatorios" className="text-sm text-suave hover:text-tinta transition">← Voltar</Link>} />

      <Cartao className="flex flex-wrap items-end gap-3">
        <Select label="Rota" value={rotaId} onChange={(e) => setRotaId(e.target.value)} className="sm:w-48">
          <option value="">Todas</option>
          {(rotas ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </Select>
      </Cartao>

      {isLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div> : d && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Cartao className="text-center">
              <p className="text-suave text-sm">Locações ativas</p>
              <p className="text-3xl font-bold text-feltro mt-2">{d.ativas}</p>
            </Cartao>
            <Cartao className="text-center">
              <p className="text-suave text-sm">Locações finalizadas</p>
              <p className="text-3xl font-bold text-suave mt-2">{d.finalizadas}</p>
            </Cartao>
          </div>

          {d.porStatus && d.porStatus.length > 0 && (
            <Cartao>
              <h2 className="font-display font-semibold mb-4">Distribuição por status</h2>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={d.porStatus} dataKey="total" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, total }) => `${status}: ${total}`}>
                      {d.porStatus.map((_: any, i: number) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Cartao>
          )}
        </>
      )}
    </div>
  );
}
