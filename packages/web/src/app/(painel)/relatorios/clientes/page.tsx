'use client';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { useApi } from '@/lib/swr';
import { Cartao, Select, Header, SkeletonCard } from '@/components/ui/primitives';
import Link from 'next/link';

export default function RelatorioClientes() {
  const [rotaId, setRotaId] = useState('');
  const { data: d, isLoading } = useApi<any>(`/relatorios/clientes${rotaId ? `?rotaId=${rotaId}` : ''}`);
  const { data: rotas } = useApi<any[]>('/rotas');

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Relatório de Clientes" subtitulo="Distribuição de clientes por rota"
        acoes={<Link href="/relatorios" className="text-sm text-suave hover:text-tinta transition">← Voltar</Link>} />

      <Cartao className="flex flex-wrap items-end gap-3">
        <Select label="Rota" value={rotaId} onChange={(e) => setRotaId(e.target.value)} className="sm:w-48">
          <option value="">Todas</option>
          {(rotas ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </Select>
      </Cartao>

      {isLoading ? <SkeletonCard /> : d && (
        <>
          <Cartao className="text-center">
            <p className="text-suave text-sm">Total de clientes ativos</p>
            <p className="text-3xl font-bold text-feltro mt-2">{d.total}</p>
          </Cartao>

          {d.porRota && d.porRota.length > 0 && (
            <Cartao>
              <h2 className="font-display font-semibold mb-4">Clientes por rota</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.porRota}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E3E7E3" />
                    <XAxis dataKey="rota" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#11392B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Cartao>
          )}
        </>
      )}
    </div>
  );
}
