'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatarBRL, type PassoCalculo } from '@locacoes/shared';
import { NovaLocacao } from './NovaLocacao';
import { FinalizarLocacao } from './FinalizarLocacao';
import { EditarLocacao } from './EditarLocacao';

interface Locacao {
  id: string; regra: string; status: string; saldoAtual: string;
  frequencia?: string | null; valorFixo?: string | null;
  valorPartida?: string | null; percentual?: string | null;
  produto: { id: string; plaqueta: string; contador?: number; tipoProduto: { nome: string } };
  cliente: { id: string; nome: string };
  endereco: { logradouro: string; numero: string; bairro: string };
  cobrancas: { dataCobranca: string }[];
}
interface Previa { valorLiquidoFinal: string; passos: PassoCalculo[]; erros?: string[] }

const NOME_REGRA: Record<string, string> = {
  VALOR_FIXO: 'Valor fixo', PERCENTUAL_A_RECEBER: '% a receber', PERCENTUAL_A_PAGAR: '% a pagar',
};

function PainelCobranca({ locacao, fechar }: { locacao: Locacao; fechar: () => void }) {
  const qc = useQueryClient();
  const [outroCobrando, setOutroCobrando] = useState<string | null>(null);
  const [contador, setContador] = useState('');

  // Bloqueio lógico (spec §6.2): sinaliza abertura e avisa se outro
  // usuário (ex.: cobrador em campo) está com a mesma locação aberta.
  useEffect(() => {
    let ativo = true;
    api<{ outroUsuario: { nome: string } | null }>(
      `/api/locacoes/${locacao.id}/sinalizar-cobranca`, { method: 'POST' }
    )
      .then((r) => { if (ativo) setOutroCobrando(r.outroUsuario?.nome ?? null); })
      .catch(() => {});
    return () => {
      ativo = false;
      api(`/api/locacoes/${locacao.id}/sinalizar-cobranca`, { method: 'DELETE' }).catch(() => {});
    };
  }, [locacao.id]);
  const [acrescimo, setAcrescimo] = useState('0');
  const [descPartidas, setDescPartidas] = useState('0');
  const [descValor, setDescValor] = useState('0');
  const [pago, setPago] = useState('');
  const [forma, setForma] = useState('DINHEIRO');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState('');
  const ehPct = locacao.regra !== 'VALOR_FIXO';

  const calcular = useMutation({
    mutationFn: () => api<Previa>(`/api/locacoes/${locacao.id}/calcular`, {
      method: 'POST',
      body: JSON.stringify({
        contadorAtual: ehPct ? parseInt(contador, 10) : null,
        descontoPartidas: parseInt(descPartidas, 10) || 0,
        acrescimo, descontoValorReceber: descValor,
      }),
    }),
    onSuccess: (p) => { setPrevia(p); setErro((p.erros ?? []).join(' ')); },
    onError: (e: Error) => setErro(e.message),
  });

  const registrar = useMutation({
    mutationFn: () => api(`/api/locacoes/${locacao.id}/cobrancas`, {
      method: 'POST',
      body: JSON.stringify({
        contadorAtual: ehPct ? parseInt(contador, 10) : null,
        descontoPartidas: parseInt(descPartidas, 10) || 0,
        acrescimo, descontoValorReceber: descValor,
        valorRecebidoPago: pago.replace(',', '.'), formaPagamento: forma,
      }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locacoes'] }); fechar(); },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <div className="border-t bg-stone-50 p-4">
      {outroCobrando && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm font-semibold text-red-700">
          ⚠ {outroCobrando} também está com esta locação aberta agora — risco de cobrança duplicada.
        </p>
      )}
      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        {ehPct && (
          <>
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Contador atual *" value={contador} onChange={(e) => setContador(e.target.value.replace(/\D/g, ''))} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Desconto partidas" value={descPartidas} onChange={(e) => setDescPartidas(e.target.value.replace(/\D/g, ''))} />
          </>
        )}
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Acréscimo R$" value={acrescimo} onChange={(e) => setAcrescimo(e.target.value)} />
        {locacao.regra === 'PERCENTUAL_A_RECEBER' && (
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Desconto valor R$" value={descValor} onChange={(e) => setDescValor(e.target.value)} />
        )}
        <button onClick={() => calcular.mutate()} disabled={(ehPct && !contador) || calcular.isPending}
          className="rounded-lg border border-feltro px-3 py-2 text-sm font-semibold text-feltro disabled:opacity-40">
          Calcular
        </button>
      </div>

      {previa && (
        <div className="mb-3 rounded-lg bg-white p-3 text-sm">
          {previa.passos.map((p, i) => (
            <div key={i} className="flex justify-between border-b py-1 last:border-0">
              <span className="text-stone-500">{p.descricao}</span><span className="font-medium">{p.valor}</span>
            </div>
          ))}
        </div>
      )}
      {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}

      {previa && !erro && (
        <div className="flex flex-wrap items-center gap-3">
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder={`Valor recebido (sugestão: ${previa.valorLiquidoFinal})`} value={pago} onChange={(e) => setPago(e.target.value)} />
          <select className="rounded-lg border px-3 py-2 text-sm" value={forma} onChange={(e) => setForma(e.target.value)}>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="PIX_MANUAL">PIX manual</option>
            <option value="CARTAO">Cartão</option>
            <option value="PIX_MERCADO_PAGO">PIX QR Code</option>
          </select>
          <button onClick={() => registrar.mutate()} disabled={!pago || registrar.isPending}
            className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            Registrar cobrança
          </button>
        </div>
      )}
    </div>
  );
}

export default function LocacoesPage() {
  const [filtro, setFiltro] = useState('ATIVA');
  const [aberta, setAberta] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState<string | null>(null);
  const [editandoRegras, setEditandoRegras] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [produtoRelocacao, setProdutoRelocacao] = useState<{ id: string; plaqueta: string } | null>(null);
  const { data: locacoes } = useQuery({
    queryKey: ['locacoes', filtro],
    queryFn: () => api<Locacao[]>(`/api/locacoes?status=${filtro}`),
  });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-feltro">Locações</h1>
        <div className="flex gap-2">
          <button onClick={() => { setNovaAberta(!novaAberta); setProdutoRelocacao(null); }}
            className="rounded-lg bg-feltro px-3 py-1.5 text-sm font-semibold text-white">
            {novaAberta ? 'Cancelar' : '+ Nova locação'}
          </button>
          {['ATIVA', 'FINALIZADA'].map((s) => (
            <button key={s} onClick={() => setFiltro(s)}
              className={`rounded-lg px-3 py-1.5 text-sm ${filtro === s ? 'bg-feltro text-white' : 'bg-white'}`}>
              {s === 'ATIVA' ? 'Ativas' : 'Finalizadas'}
            </button>
          ))}
        </div>
      </div>

      {(novaAberta || produtoRelocacao) && (
        <NovaLocacao
          produtoPreSelecionado={produtoRelocacao}
          fechar={() => { setNovaAberta(false); setProdutoRelocacao(null); }}
        />
      )}

      {locacoes?.map((l) => {
        const saldo = Number(l.saldoAtual);
        const ultima = l.cobrancas[0]?.dataCobranca;
        return (
          <div key={l.id} className="mb-3 overflow-hidden rounded-xl bg-white shadow-sm">
            <button className="flex w-full items-center justify-between p-4 text-left" onClick={() => setAberta(aberta === l.id ? null : l.id)}>
              <div>
                <p className="font-semibold">{l.produto.plaqueta} · {l.cliente.nome}</p>
                <p className="text-xs text-stone-500">
                  {NOME_REGRA[l.regra]} · {l.endereco.logradouro}, {l.endereco.numero} – {l.endereco.bairro}
                  {ultima ? ` · última cobrança ${new Date(ultima).toLocaleDateString('pt-BR')}` : ' · nunca cobrada'}
                </p>
              </div>
              <div className="text-right">
                {saldo !== 0 && (
                  <p className={saldo > 0 ? 'text-sm font-semibold text-red-600' : 'text-sm font-semibold text-feltro'}>
                    {saldo > 0 ? `Deve ${formatarBRL(saldo)}` : `Haver ${formatarBRL(-saldo)}`}
                  </p>
                )}
                {l.status === 'ATIVA' && <p className="text-xs text-stone-400">{aberta === l.id ? 'fechar ▲' : 'cobrar ▼'}</p>}
              </div>
            </button>
            {aberta === l.id && l.status === 'ATIVA' && (
              <>
                <PainelCobranca locacao={l} fechar={() => setAberta(null)} />
                {editandoRegras === l.id ? (
                  <EditarLocacao locacao={l} fechar={() => setEditandoRegras(null)} />
                ) : finalizando === l.id ? (
                  <FinalizarLocacao
                    locacaoId={l.id}
                    saldoAtual={l.saldoAtual}
                    plaqueta={l.produto.plaqueta}
                    produtoId={l.produto.id}
                    fechar={() => { setFinalizando(null); setAberta(null); }}
                    aoRelocar={(p) => { setFinalizando(null); setAberta(null); setProdutoRelocacao(p); }}
                  />
                ) : (
                  <div className="flex justify-end gap-4 border-t p-3">
                    <button onClick={() => setEditandoRegras(l.id)}
                      className="text-sm text-stone-500 underline-offset-2 hover:text-feltro hover:underline">
                      Editar regras…
                    </button>
                    <button onClick={() => setFinalizando(l.id)}
                      className="text-sm text-stone-500 underline-offset-2 hover:text-feltro hover:underline">
                      Finalizar locação…
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      {(locacoes?.length ?? 0) === 0 && (
        <p className="rounded-xl bg-white p-6 text-center text-stone-400 shadow-sm">Nenhuma locação {filtro === 'ATIVA' ? 'ativa' : 'finalizada'}.</p>
      )}
    </div>
  );
}
