// apps/web/src/app/painel/locacoes/NovaLocacao.tsx
'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface Cliente {
  id: string; nome: string;
  enderecos: { id: string; logradouro: string; numero: string; bairro: string }[];
}
interface Produto { id: string; plaqueta: string; contador: number; tipoProduto: { nome: string } }

export function NovaLocacao({
  fechar,
  produtoPreSelecionado,
}: {
  fechar: () => void;
  produtoPreSelecionado?: { id: string; plaqueta: string } | null;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [clienteId, setClienteId] = useState('');
  const [enderecoId, setEnderecoId] = useState('');
  const [produtoId, setProdutoId] = useState(produtoPreSelecionado?.id ?? '');
  const [regra, setRegra] = useState<'VALOR_FIXO' | 'PERCENTUAL_A_RECEBER' | 'PERCENTUAL_A_PAGAR'>('VALOR_FIXO');
  const [frequencia, setFrequencia] = useState('MENSAL');
  const [valorFixo, setValorFixo] = useState('');
  const [valorPartida, setValorPartida] = useState('');
  const [percentual, setPercentual] = useState('50');
  const [contadorInicial, setContadorInicial] = useState('');
  const [erro, setErro] = useState('');

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => api<Cliente[]>('/api/clientes'),
  });
  const { data: produtos } = useQuery({
    queryKey: ['produtos-disponiveis'],
    queryFn: () => api<Produto[]>('/api/produtos?disponiveis=true'),
    enabled: !produtoPreSelecionado,
  });

  const cliente = useMemo(() => clientes?.find((c) => c.id === clienteId), [clientes, clienteId]);
  const produto = useMemo(() => produtos?.find((p) => p.id === produtoId), [produtos, produtoId]);
  const ehPercentual = regra !== 'VALOR_FIXO';

  const criar = useMutation({
    mutationFn: () =>
      api('/api/locacoes', {
        method: 'POST',
        body: JSON.stringify({
          clienteId,
          enderecoId,
          produtoId,
          regra,
          frequencia: regra === 'VALOR_FIXO' ? frequencia : null,
          valorFixo: regra === 'VALOR_FIXO' ? valorFixo.replace(',', '.') : null,
          valorPartida: ehPercentual ? valorPartida.replace(',', '.') : null,
          // percentual entra como fração: 50 → 0.5
          percentual: ehPercentual ? String(Number(percentual.replace(',', '.')) / 100) : null,
          contadorInicial: parseInt(contadorInicial, 10) || 0,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locacoes'] });
      qc.invalidateQueries({ queryKey: ['produtos-disponiveis'] });
      fechar();
      toast({ titulo: 'Locação criada' });
    },
    onError: (e: Error) => setErro(e.message),
  });

  const valido =
    clienteId && enderecoId && produtoId && contadorInicial !== '' &&
    (regra === 'VALOR_FIXO' ? !!valorFixo : !!valorPartida && !!percentual);

  return (
    <div className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 font-bold text-feltro">
        Nova locação{produtoPreSelecionado ? ` — ${produtoPreSelecionado.plaqueta} (relocação)` : ''}
      </h2>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <select className="rounded-lg border px-3 py-2 text-sm" value={clienteId}
          onChange={(e) => { setClienteId(e.target.value); setEnderecoId(''); }}>
          <option value="">Cliente *</option>
          {clientes?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>

        <select className="rounded-lg border px-3 py-2 text-sm" value={enderecoId}
          onChange={(e) => setEnderecoId(e.target.value)} disabled={!cliente}>
          <option value="">Endereço de instalação *</option>
          {cliente?.enderecos.map((e) => (
            <option key={e.id} value={e.id}>{e.logradouro}, {e.numero} – {e.bairro}</option>
          ))}
        </select>

        {!produtoPreSelecionado && (
          <select className="rounded-lg border px-3 py-2 text-sm" value={produtoId}
            onChange={(e) => {
              setProdutoId(e.target.value);
              const p = produtos?.find((x) => x.id === e.target.value);
              if (p) setContadorInicial(String(p.contador));
            }}>
            <option value="">Produto disponível *</option>
            {produtos?.map((p) => (
              <option key={p.id} value={p.id}>{p.plaqueta} · {p.tipoProduto.nome}</option>
            ))}
          </select>
        )}
      </div>

      <p className="mb-2 text-sm font-semibold">Regra de cobrança</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ['VALOR_FIXO', 'Valor fixo'],
          ['PERCENTUAL_A_RECEBER', 'Percentual a receber'],
          ['PERCENTUAL_A_PAGAR', 'Percentual a pagar'],
        ] as const).map(([valor, rotulo]) => (
          <button key={valor} onClick={() => setRegra(valor)}
            className={`rounded-full border px-4 py-1.5 text-sm ${regra === valor ? 'border-feltro bg-feltro text-white' : 'border-border'}`}>
            {rotulo}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {regra === 'VALOR_FIXO' ? (
          <>
            <select className="rounded-lg border px-3 py-2 text-sm" value={frequencia} onChange={(e) => setFrequencia(e.target.value)}>
              <option value="SEMANAL">Semanal</option>
              <option value="QUINZENAL">Quinzenal</option>
              <option value="MENSAL">Mensal</option>
            </select>
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Valor fixo R$ *" value={valorFixo} onChange={(e) => setValorFixo(e.target.value)} />
          </>
        ) : (
          <>
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Valor da partida R$ *" value={valorPartida} onChange={(e) => setValorPartida(e.target.value)} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Percentual % *" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
          </>
        )}
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Contador inicial *" value={contadorInicial}
          onChange={(e) => setContadorInicial(e.target.value.replace(/\D/g, ''))} />
      </div>

      {produto && parseInt(contadorInicial || '0', 10) !== produto.contador && (
        <p className="mb-3 text-xs text-amber-600">
          ⚠ Contador informado ({contadorInicial}) difere do registrado no produto ({produto.contador}). O contador do produto será atualizado.
        </p>
      )}
      {erro && <p className="mb-3 text-sm text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <button onClick={() => criar.mutate()} disabled={!valido || criar.isPending}
          className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {criar.isPending ? 'Criando…' : 'Criar locação'}
        </button>
        <button onClick={fechar} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground/80">
          Cancelar
        </button>
      </div>
    </div>
  );
}
