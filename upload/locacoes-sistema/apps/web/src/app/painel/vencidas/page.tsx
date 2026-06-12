'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MiniStat } from '@/components/ui/MiniStat';
import { EmptyState } from '@/components/ui/EmptyState';
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
      <div className="mb-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">
              {v.cliente.nome} <span className="font-normal text-muted-foreground">· {v.plaqueta}</span>
            </p>
            <p className="text-xs text-muted-foreground">{v.endereco} · rota {v.rota}</p>
            <p className="mt-1 text-xs text-muted-foreground">
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
              <p className="mt-1 text-sm font-bold text-destructive">{formatarBRL(v.valorEstimado)} estimado</p>
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
      <PageHeader icone={CalendarClock} titulo="Cobranças Vencidas"
        descricao="Período estourado (valor fixo) e leituras atrasadas (percentual)">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Percentual sem leitura há (dias)</label>
          <input type="number" min={1} className="w-32 rounded-lg border px-3 py-2 text-sm"
            value={diasPercentual} onChange={(e) => setDiasPercentual(e.target.value || '30')} />
        </div>
      </PageHeader>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <MiniStat rotulo="Vencidas (valor fixo)" valor={fixas.length}
          cor={fixas.length > 0 ? 'text-amber-600' : 'text-muted-foreground'} />
        <MiniStat rotulo="Valor estimado a receber" valor={formatarBRL(totalEstimado)}
          cor={totalEstimado > 0 ? 'text-destructive' : 'text-muted-foreground'} />
        <MiniStat rotulo="Total de alertas" valor={vencidas?.length ?? 0} />
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando…</p>}

      {!isLoading && (vencidas?.length ?? 0) === 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <EmptyState icone={CheckCircle2} titulo="Tudo em dia"
            descricao="Nenhuma cobrança vencida nas suas rotas no momento." />
        </div>
      )}

      {fixas.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Valor fixo — período estourado</h2>
          {fixas.map((v) => <Cartao key={v.locacaoId} v={v} />)}
        </>
      )}

      {percentuais.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Percentual — sem leitura de contador há mais de {diasPercentual} dias
          </h2>
          {percentuais.map((v) => <Cartao key={v.locacaoId} v={v} />)}
        </>
      )}
    </div>
  );
}
