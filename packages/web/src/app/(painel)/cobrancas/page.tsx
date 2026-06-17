'use client';
import { useEffect, useMemo, useState } from 'react';
import { calcularValorFixo, calcularPercentual } from '@app/core';
import { api } from '@/lib/api';
import { formatarBRL } from '@/lib/format';
import { Botao, Campo, Cartao } from '@/components/ui/primitives';

export default function RegistrarCobranca() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [locacoes, setLocacoes] = useState<any[]>([]);
  const [ctx, setCtx] = useState<any | null>(null);
  const [contador, setContador] = useState(''); const [valorPago, setValorPago] = useState('');
  const [forma, setForma] = useState('DINHEIRO'); const [trocaPano, setTrocaPano] = useState(false);
  const [msg, setMsg] = useState(''); const [erro, setErro] = useState('');

  useEffect(() => { api.get('/clientes').then(setClientes).catch(() => setClientes([])); }, []);
  useEffect(() => { setLocacoes([]); setCtx(null); if (clienteId) api.get(`/locacoes?clienteId=${clienteId}`).then(setLocacoes).catch(() => setLocacoes([])); }, [clienteId]);

  function escolherLocacao(id: string) {
    setCtx(null); setContador(''); setValorPago(''); setMsg('');
    if (id) api.get(`/locacoes/${id}/contexto-cobranca`).then(setCtx).catch((e) => setErro(e.message));
  }

  // Pré-visualização AO VIVO com o mesmo motor do servidor (@app/core).
  const previsao = useMemo(() => {
    if (!ctx) return null;
    const l = ctx.locacao;
    try {
      if (l.regra === 'VALOR_FIXO') {
        return calcularValorFixo({ valorFixo: l.valorFixo, frequencia: l.frequencia, dataReferencia: new Date(ctx.dataReferencia), hoje: new Date(), saldoAnterior: ctx.saldoAnterior });
      }
      if (!contador) return null;
      return calcularPercentual({ regra: l.regra, contadorAnterior: ctx.contadorAnterior, contadorAtual: Number(contador), valorPartida: l.valorPartida, percentual: l.percentual, saldoAnterior: ctx.saldoAnterior });
    } catch { return null; }
  }, [ctx, contador]);

  async function registrar() {
    setErro(''); setMsg('');
    try {
      const r = await api.post('/cobrancas', {
        locacaoId: ctx.locacao.id,
        contadorAtual: ctx.locacao.regra !== 'VALOR_FIXO' ? Number(contador) : undefined,
        trocaPano,
        pagamento: valorPago ? { valor: Number(valorPago), formaPagamento: forma } : undefined,
      });
      setMsg(`Cobrança registrada. Saldo atualizado: ${formatarBRL(r.saldoAtualizado)}.`);
      escolherLocacao(ctx.locacao.id); // recarrega contexto
    } catch (e: any) { setErro(e.message); }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Registrar cobrança</h1>

      <Cartao className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-suave font-medium">Cliente</span>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="border border-borda rounded-xl px-3 py-2 bg-white">
            <option value="">Selecione…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        {clienteId && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-suave font-medium">Locação ativa</span>
            <select onChange={(e) => escolherLocacao(e.target.value)} className="border border-borda rounded-xl px-3 py-2 bg-white">
              <option value="">Selecione…</option>
              {locacoes.map((l) => <option key={l.id} value={l.id}>{l.produto?.plaqueta} • {l.regra}</option>)}
            </select>
          </label>
        )}
      </Cartao>

      {ctx && (
        <Cartao className="flex flex-col gap-3">
          <p className="text-sm text-suave">Saldo anterior: <span className="valor">{formatarBRL(ctx.saldoAnterior)}</span></p>
          {ctx.locacao.regra !== 'VALOR_FIXO' && (
            <Campo label={`Contador atual (anterior: ${ctx.contadorAnterior})`} inputMode="numeric" value={contador} onChange={(e) => setContador(e.target.value)} />
          )}
          <Campo label="Valor recebido/pago" inputMode="decimal" value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-suave font-medium">Forma de pagamento</span>
            <select value={forma} onChange={(e) => setForma(e.target.value)} className="border border-borda rounded-xl px-3 py-2 bg-white">
              {['DINHEIRO', 'PIX_MANUAL', 'CARTAO', 'PIX_MERCADO_PAGO'].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={trocaPano} onChange={(e) => setTrocaPano(e.target.checked)} /> Troca de pano</label>

          {previsao && (
            <div className="bg-papel rounded-xl p-4 text-sm">
              <p className="font-medium mb-1">Pré-visualização</p>
              {previsao.memorial.map((m: any, i: number) => <p key={i} className="text-suave">{m.rotulo}: {m.valor}</p>)}
              <p className="valor text-lg font-semibold text-feltro mt-2">Líquido: {formatarBRL(previsao.valorLiquidoFinal.toString())}</p>
            </div>
          )}

          {msg && <p className="text-feltro text-sm">{msg}</p>}
          {erro && <p className="text-alerta text-sm">{erro}</p>}
          <Botao onClick={registrar}>Registrar cobrança</Botao>
        </Cartao>
      )}
    </div>
  );
}
