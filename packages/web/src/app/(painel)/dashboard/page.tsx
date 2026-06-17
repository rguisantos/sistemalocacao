'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '@/lib/api';
import { formatarBRL } from '@/lib/format';
import { Cartao } from '@/components/ui/primitives';

interface Dados { faturamentoMes: number; inadimplencia: number; locacoesAtivas: number; porRota: { rota: string; valor: number }[]; }

export default function Dashboard() {
  const [d, setD] = useState<Dados | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'indisponivel'>('carregando');

  useEffect(() => {
    api.get('/relatorios/dashboard').then((r) => { setD(r); setEstado('ok'); }).catch(() => setEstado('indisponivel'));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Painel</h1>

      {estado === 'indisponivel' && (
        <Cartao className="text-suave">Os relatórios consolidados entram na Fase 6. Os cadastros e cobranças já estão ativos no menu lateral.</Cartao>
      )}

      {estado === 'ok' && d && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Indicador titulo="Faturamento do mês" valor={formatarBRL(d.faturamentoMes)} />
            <Indicador titulo="Inadimplência" valor={formatarBRL(d.inadimplencia)} alerta />
            <Indicador titulo="Locações ativas" valor={String(d.locacoesAtivas)} />
          </div>
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
        </>
      )}
    </div>
  );
}

function Indicador({ titulo, valor, alerta }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <Cartao>
      <p className="text-suave text-sm">{titulo}</p>
      <p className={`valor text-2xl font-semibold mt-2 ${alerta ? 'text-alerta' : 'text-feltro'}`}>{valor}</p>
    </Cartao>
  );
}
