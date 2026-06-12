'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
    <div className="mb-3 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{saldo.cliente.nome}</p>
          <p className="text-xs text-stone-500">
            {saldo.locacao.produto.plaqueta} · rota {saldo.cliente.rota.nome} ·
            criado em {new Date(saldo.createdAt).toLocaleDateString('pt-BR')}
            {saldo.pagamentos.length > 0 && ` · ${saldo.pagamentos.length} pagamento(s)`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-red-600">{formatarBRL(saldo.valorRestante)}</p>
          <p className="text-xs text-stone-400">de {formatarBRL(saldo.valorOriginal)}</p>
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
          <button onClick={() => setPagando(false)} className="text-sm text-stone-500">Cancelar</button>
          {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-feltro">Saldos devedores</h1>
          <p className="text-sm text-stone-500">Dívidas de locações finalizadas vinculadas ao cliente.</p>
        </div>
        <div className="flex gap-2">
          {[['PENDENTE', 'Pendentes'], ['QUITADO', 'Quitados']].map(([v, r]) => (
            <button key={v} onClick={() => setStatus(v)}
              className={`rounded-lg px-3 py-1.5 text-sm ${status === v ? 'bg-feltro text-white' : 'bg-white'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {status === 'PENDENTE' && (saldos?.length ?? 0) > 0 && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          Total em aberto: <strong>{formatarBRL(totalPendente)}</strong>
        </p>
      )}

      {saldos?.map((s) => <LinhaSaldo key={s.id} saldo={s} />)}
      {(saldos?.length ?? 0) === 0 && (
        <p className="rounded-xl bg-white p-6 text-center text-stone-400 shadow-sm">
          Nenhum saldo {status === 'PENDENTE' ? 'pendente' : 'quitado'}.
        </p>
      )}
    </div>
  );
}
