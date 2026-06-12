'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Props {
  locacao: {
    id: string; regra: string;
    frequencia?: string | null; valorFixo?: string | null;
    valorPartida?: string | null; percentual?: string | null;
    produto: { contador?: number };
  };
  fechar: () => void;
}

export function EditarLocacao({ locacao, fechar }: Props) {
  const qc = useQueryClient();
  const [regra, setRegra] = useState(locacao.regra);
  const [frequencia, setFrequencia] = useState(locacao.frequencia ?? 'MENSAL');
  const [valorFixo, setValorFixo] = useState(locacao.valorFixo ?? '');
  const [valorPartida, setValorPartida] = useState(locacao.valorPartida ?? '');
  const [percentual, setPercentual] = useState(
    locacao.percentual ? String(Number(locacao.percentual) * 100) : ''
  );
  const [contador, setContador] = useState('');
  const [erro, setErro] = useState('');

  const salvar = useMutation({
    mutationFn: () =>
      api(`/api/locacoes/${locacao.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          regra,
          frequencia: regra === 'VALOR_FIXO' ? frequencia : null,
          valorFixo: regra === 'VALOR_FIXO' ? valorFixo.replace(',', '.') : null,
          valorPartida: regra !== 'VALOR_FIXO' ? valorPartida.replace(',', '.') : null,
          percentual: regra !== 'VALOR_FIXO' ? String(Number(percentual.replace(',', '.')) / 100) : null,
          ...(contador !== '' ? { contadorAtual: parseInt(contador, 10) } : {}),
        }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locacoes'] }); fechar(); },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <div className="border-t bg-stone-50 p-4">
      <p className="mb-1 text-sm font-semibold text-stone-700">Editar regras da locação</p>
      <p className="mb-3 text-xs text-amber-600">
        Cálculos futuros usarão a nova regra. A alteração é auditada (antes/depois).
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {([['VALOR_FIXO', 'Valor fixo'], ['PERCENTUAL_A_RECEBER', '% a receber'], ['PERCENTUAL_A_PAGAR', '% a pagar']] as const).map(([v, r]) => (
          <button key={v} onClick={() => setRegra(v)}
            className={`rounded-full border px-3 py-1.5 text-sm ${regra === v ? 'border-feltro bg-feltro text-white' : 'border-stone-300 bg-white'}`}>
            {r}
          </button>
        ))}
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        {regra === 'VALOR_FIXO' ? (
          <>
            <select className="rounded-lg border px-3 py-2 text-sm" value={frequencia} onChange={(e) => setFrequencia(e.target.value)}>
              <option value="SEMANAL">Semanal</option>
              <option value="QUINZENAL">Quinzenal</option>
              <option value="MENSAL">Mensal</option>
            </select>
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Valor fixo R$" value={valorFixo} onChange={(e) => setValorFixo(e.target.value)} />
          </>
        ) : (
          <>
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Valor partida R$" value={valorPartida} onChange={(e) => setValorPartida(e.target.value)} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Percentual %" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
          </>
        )}
        <input className="rounded-lg border px-3 py-2 text-sm"
          placeholder={`Contador (atual: ${locacao.produto?.contador ?? '—'})`}
          title="Preencha apenas para corrigir a leitura — exige permissão própria"
          value={contador} onChange={(e) => setContador(e.target.value.replace(/\D/g, ''))} />
      </div>

      {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button onClick={() => salvar.mutate()} disabled={salvar.isPending}
          className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Salvar alterações
        </button>
        <button onClick={fechar} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-600">
          Cancelar
        </button>
      </div>
    </div>
  );
}
