// apps/web/src/app/painel/locacoes/FinalizarLocacao.tsx
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatarBRL } from '@locacoes/shared';

interface Deposito { id: string; nome: string }

export function FinalizarLocacao({
  locacaoId,
  saldoAtual,
  plaqueta,
  produtoId,
  fechar,
  aoRelocar,
}: {
  locacaoId: string;
  saldoAtual: string;
  plaqueta: string;
  produtoId: string;
  fechar: () => void;
  aoRelocar: (produto: { id: string; plaqueta: string }) => void;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<'DEPOSITO' | 'RELOCACAO'>('DEPOSITO');
  const [depositoId, setDepositoId] = useState('');
  const [erro, setErro] = useState('');

  const { data: depositos } = useQuery({
    queryKey: ['depositos'],
    queryFn: () => api<Deposito[]>('/api/depositos'),
  });

  const finalizar = useMutation({
    mutationFn: () =>
      api(`/api/locacoes/${locacaoId}/finalizar`, {
        method: 'POST',
        body: JSON.stringify({ tipo, depositoId: tipo === 'DEPOSITO' ? depositoId : null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locacoes'] });
      qc.invalidateQueries({ queryKey: ['saldos'] });
      if (tipo === 'RELOCACAO') {
        aoRelocar({ id: produtoId, plaqueta }); // abre form de nova locação com o produto
      } else {
        fechar();
      }
    },
    onError: (e: Error) => setErro(e.message),
  });

  const devendo = Number(saldoAtual) > 0;

  return (
    <div className="border-t bg-amber-50/60 p-4">
      <p className="mb-3 text-sm font-semibold text-stone-700">Finalizar locação de {plaqueta}</p>

      {devendo && (
        <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800">
          Saldo devedor de {formatarBRL(saldoAtual)} será vinculado ao cliente como dívida pendente,
          cobrável depois em <strong>Saldos Devedores</strong>.
        </p>
      )}

      <div className="mb-3 flex gap-2">
        {([['DEPOSITO', 'Recolher para depósito'], ['RELOCACAO', 'Relocação (novo cliente/endereço)']] as const).map(
          ([valor, rotulo]) => (
            <button key={valor} onClick={() => setTipo(valor)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${tipo === valor ? 'border-feltro bg-feltro text-white' : 'border-stone-300 bg-white'}`}>
              {rotulo}
            </button>
          )
        )}
      </div>

      {tipo === 'DEPOSITO' && (
        <select className="mb-3 rounded-lg border px-3 py-2 text-sm" value={depositoId} onChange={(e) => setDepositoId(e.target.value)}>
          <option value="">Depósito de destino *</option>
          {depositos?.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
      )}

      {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => finalizar.mutate()}
          disabled={(tipo === 'DEPOSITO' && !depositoId) || finalizar.isPending}
          className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {finalizar.isPending ? 'Finalizando…' : 'Confirmar finalização'}
        </button>
        <button onClick={fechar} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-600">
          Cancelar
        </button>
      </div>
    </div>
  );
}
