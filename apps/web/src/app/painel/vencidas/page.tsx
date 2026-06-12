'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatarBRL } from '@locacoes/shared';

interface Vencida {
  locacaoId: string; regra: string; plaqueta: string;
  cliente: { id: string; nome: string; telefones: { numero: string; tipo: string }[] };
  rota: string; endereco: string;
  ultimaCobranca: string | null;
  diasSemCobranca: number; diasAtraso: number;
  valorEstimado: string | null; saldoAtual: string;
}

export default function VencidasPage() {
  const [diasPercentual, setDiasPercentual] = useState('30');
  const { data: vencidas, isLoading } = useQuery({
    queryKey: ['vencidas', diasPercentual],
    queryFn: () => api<Vencida[]>(`/api/relatorios/vencidas?diasPercentual=${diasPercentual}`),
    refetchInterval: 5 * 60_000,
  });

  const fixas = vencidas?.filter((v) => v.regra === 'VALOR_FIXO') ?? [];
  const percentuais = vencidas?.filter((v) => v.regra !== 'VALOR_FIXO') ?? [];
  const totalEstimado = fixas.reduce((acc, v) => acc + Number(v.valorEstimado ?? 0), 0);

  function corAtraso(dias: number) {
    if (dias > 30) return 'bg-red-100 text-red-800';
    if (dias > 7) return 'bg-amber-100 text-amber-800';
    return 'bg-yellow-50 text-yellow-700';
  }

  function Cartao({ v }: { v: Vencida }) {
    const tel = v.cliente.telefones?.[0]?.numero;
    return (
      <div className="mb-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">
              {v.cliente.nome} <span className="font-normal text-stone-400">· {v.plaqueta}</span>
            </p>
            <p className="text-xs text-stone-500">{v.endereco} · rota {v.rota}</p>
            <p className="mt-1 text-xs text-stone-500">
              {v.ultimaCobranca
                ? `Última cobrança em ${new Date(v.ultimaCobranca).toLocaleDateString('pt-BR')}`
                : 'Nunca cobrada'} · {v.diasSemCobranca} dias sem cobrança
              {Number(v.saldoAtual) > 0 && ` · saldo devedor ${formatarBRL(v.saldoAtual)}`}
            </p>
          </div>
          <div className="text-right">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${corAtraso(v.diasAtraso)}`}>
              {v.diasAtraso}d de atraso
            </span>
            {v.valorEstimado && (
              <p className="mt-1 text-sm font-bold text-red-600">{formatarBRL(v.valorEstimado)} estimado</p>
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-3 text-sm">
          <Link href="/painel/locacoes" className="text-feltro underline-offset-2 hover:underline">
            Abrir em Locações
          </Link>
          {tel && (
            <a href={`https://wa.me/55${tel.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
              className="text-feltro underline-offset-2 hover:underline">
              WhatsApp {tel}
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-feltro">Cobranças vencidas</h1>
          <p className="text-sm text-stone-500">
            {fixas.length} locação(ões) de valor fixo vencida(s)
            {totalEstimado > 0 && ` · ${formatarBRL(totalEstimado)} estimados a receber`}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-stone-500">Alerta percentual sem leitura há (dias)</label>
          <input type="number" min={1} className="w-32 rounded-lg border px-3 py-2 text-sm"
            value={diasPercentual} onChange={(e) => setDiasPercentual(e.target.value || '30')} />
        </div>
      </div>

      {isLoading && <p className="text-stone-500">Carregando…</p>}

      {!isLoading && (vencidas?.length ?? 0) === 0 && (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-feltro">Tudo em dia ✓</p>
          <p className="text-sm text-stone-500">Nenhuma cobrança vencida nas suas rotas.</p>
        </div>
      )}

      {fixas.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-400">Valor fixo — período estourado</h2>
          {fixas.map((v) => <Cartao key={v.locacaoId} v={v} />)}
        </>
      )}

      {percentuais.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-stone-400">
            Percentual — sem leitura de contador há mais de {diasPercentual} dias
          </h2>
          {percentuais.map((v) => <Cartao key={v.locacaoId} v={v} />)}
        </>
      )}
    </div>
  );
}
