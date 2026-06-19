'use client';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useApi } from '@/lib/swr';
import { formatarBRL } from '@/lib/format';
import { Cartao, Header, SkeletonCard } from '@/components/ui/primitives';
import Link from 'next/link';

export default function RelatorioComparativo() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const hojeStr = hoje.toISOString().slice(0, 10);

  const [de, setDe] = useState(inicioMes);
  const [ate, setAte] = useState(hojeStr);

  // Período atual
  const { data: atual, isLoading: la } = useApi<any>(`/relatorios/dashboard?de=${de}&ate=${ate}`);
  // Período anterior (mesmo tamanho, deslocado para trás)
  const diff = new Date(ate).getTime() - new Date(de).getTime();
  const deAnt = new Date(new Date(de).getTime() - diff).toISOString().slice(0, 10);
  const ateAnt = new Date(new Date(de).getTime()).toISOString().slice(0, 10);
  const { data: anterior, isLoading: lb } = useApi<any>(`/relatorios/dashboard?de=${deAnt}&ate=${ateAnt}`);

  const isLoading = la || lb;

  // Monta dados comparativos por rota
  const comparativo = (() => {
    if (!atual?.porRota || !anterior?.porRota) return [];
    const mapa = new Map<string, { rota: string; atual: number; anterior: number }>();
    for (const r of atual.porRota) mapa.set(r.rota, { rota: r.rota, atual: r.valor, anterior: 0 });
    for (const r of anterior.porRota) {
      const e = mapa.get(r.rota);
      if (e) e.anterior = r.valor;
      else mapa.set(r.rota, { rota: r.rota, atual: 0, anterior: r.valor });
    }
    return [...mapa.values()];
  })();

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Comparativo" subtitulo="Comparação entre períodos"
        acoes={<Link href="/relatorios" className="text-sm text-suave hover:text-tinta transition">← Voltar</Link>} />

      <Cartao className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-suave font-medium">Período atual</span>
          <div className="flex gap-2 items-center">
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="border border-borda rounded-xl px-3 py-2 bg-white text-sm" />
            <span className="text-suave">até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="border border-borda rounded-xl px-3 py-2 bg-white text-sm" />
          </div>
        </div>
        <div className="text-xs text-suave">
          Comparando com: {new Date(deAnt + 'T12:00:00').toLocaleDateString('pt-BR')} — {new Date(ateAnt + 'T12:00:00').toLocaleDateString('pt-BR')}
        </div>
      </Cartao>

      {isLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Cartao className="text-center">
            <p className="text-suave text-sm">Faturamento período atual</p>
            <p className="text-2xl font-bold text-latao mt-2 valor">{formatarBRL(atual?.faturamentoMes ?? 0)}</p>
          </Cartao>
          <Cartao className="text-center">
            <p className="text-suave text-sm">Faturamento período anterior</p>
            <p className="text-2xl font-bold text-suave mt-2 valor">{formatarBRL(anterior?.faturamentoMes ?? 0)}</p>
          </Cartao>
        </div>
      )}

      {comparativo.length > 0 && (
        <Cartao>
          <h2 className="font-display font-semibold mb-4">Comparativo por rota</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E7E3" />
                <XAxis dataKey="rota" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatarBRL(v)} />
                <Legend />
                <Bar dataKey="atual" fill="#C08A2D" name="Período atual" radius={[4, 4, 0, 0]} />
                <Bar dataKey="anterior" fill="#E3E7E3" name="Período anterior" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
      )}
    </div>
  );
}
