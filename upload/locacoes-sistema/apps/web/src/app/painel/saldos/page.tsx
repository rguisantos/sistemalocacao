'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Wallet, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MiniStat } from '@/components/ui/MiniStat';
import { formatarBRL } from '@locacoes/shared';

interface Saldo {
  id: string; valorOriginal: string; valorRestante: string; status: string; createdAt: string;
  cliente: { id: string; nome: string; rota: { nome: string } };
  locacao: { produto: { plaqueta: string } };
  pagamentos: { id: string; valor: string; formaPagamento: string; dataPagamento: string }[];
}

function LinhaSaldo({ saldo }: { saldo: Saldo }) {
  const qc = useQueryClient();
  const [pagando, setPagando] = useState(false);
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState('DINHEIRO');
  const [erro, setErro] = useState('');

  const pagar = useMutation({
    mutationFn: () =>
      api(`/api/locacoes/saldos/${saldo.id}/pagamentos`, {
        method: 'POST',
        body: JSON.stringify({ valor: valor.replace(',', '.'), formaPagamento: forma }),
      }),
    onSuccess: () => { setPagando(false); setValor(''); qc.invalidateQueries({ queryKey: ['saldos'] }); },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <div className="mb-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{saldo.cliente.nome}</p>
          <p className="text-xs text-muted-foreground">
            {saldo.locacao.produto.plaqueta} · rota {saldo.cliente.rota.nome} ·
            criado em {new Date(saldo.createdAt).toLocaleDateString('pt-BR')}
            {saldo.pagamentos.length > 0 && ` · ${saldo.pagamentos.length} pagamento(s)`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-destructive">{formatarBRL(saldo.valorRestante)}</p>
          <p className="text-xs text-muted-foreground">de {formatarBRL(saldo.valorOriginal)}</p>
        </div>
      </div>

      {pagando ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder={`Valor (restante ${saldo.valorRestante})`}
            value={valor} onChange={(e) => setValor(e.target.value)} />
          <select className="rounded-lg border px-3 py-2 text-sm" value={forma} onChange={(e) => setForma(e.target.value)}>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="PIX_MANUAL">PIX manual</option>
            <option value="CARTAO">Cartão</option>
          </select>
          <button onClick={() => pagar.mutate()} disabled={!valor || pagar.isPending}
            className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            Registrar pagamento
          </button>
          <button onClick={() => setPagando(false)} className="text-sm text-muted-foreground">Cancelar</button>
          {erro && <p className="w-full text-sm text-destructive">{erro}</p>}
        </div>
      ) : (
        <button onClick={() => setPagando(true)} className="mt-2 text-sm text-feltro underline-offset-2 hover:underline">
          Registrar pagamento…
        </button>
      )}
    </div>
  );
}

export default function SaldosPage() {
  const [status, setStatus] = useState('PENDENTE');
  const { data: saldos } = useQuery({
    queryKey: ['saldos', status],
    queryFn: () => api<Saldo[]>(`/api/locacoes/saldos?status=${status}`),
  });

  const totalPendente = saldos
    ?.filter((s) => s.status === 'PENDENTE')
    .reduce((acc, s) => acc + Number(s.valorRestante), 0) ?? 0;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <PageHeader icone={Wallet} titulo="Saldos Devedores"
        descricao="Dívidas de locações finalizadas vinculadas ao cliente">
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          {([['PENDENTE', 'Pendentes'], ['QUITADO', 'Quitados']] as const).map(([v, r]) => (
            <button key={v} onClick={() => setStatus(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                status === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}>
              {r}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <MiniStat rotulo={status === 'PENDENTE' ? 'Dívidas pendentes' : 'Dívidas quitadas'} valor={saldos?.length ?? 0} />
        <MiniStat rotulo="Total em aberto" valor={formatarBRL(totalPendente)}
          cor={totalPendente > 0 ? 'text-destructive' : 'text-muted-foreground'} />
      </div>

      {saldos?.map((s) => <LinhaSaldo key={s.id} saldo={s} />)}
      {(saldos?.length ?? 0) === 0 && (
        <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground shadow-sm">
          Nenhum saldo {status === 'PENDENTE' ? 'pendente' : 'quitado'}.
        </p>
      )}
    </div>
  );
}
