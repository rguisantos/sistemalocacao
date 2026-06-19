'use client';
import { useEffect, useMemo, useState } from 'react';
import { calcularValorFixo, calcularPercentual } from '@app/core';
import { useApi } from '@/lib/swr';
import { api } from '@/lib/api';
import { formatarBRL } from '@/lib/format';
import { Botao, Campo, Select, Checkbox, Cartao, Header, SkeletonCard, toast } from '@/components/ui/primitives';
import { Receipt, Calculator } from 'lucide-react';

export default function RegistrarCobranca() {
  const [clienteId, setClienteId] = useState('');
  const [locacaoId, setLocacaoId] = useState('');
  const [ctx, setCtx] = useState<any | null>(null);
  const [contador, setContador] = useState('');
  const [valorPago, setValorPago] = useState('');
  const [forma, setForma] = useState('DINHEIRO');
  const [trocaPano, setTrocaPano] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { data: clientes } = useApi<any[]>('/clientes');
  const { data: locacoes } = useApi<any[]>(clienteId ? `/locacoes?clienteId=${clienteId}` : null);

  function escolherLocacao(id: string) {
    setLocacaoId(id); setCtx(null); setContador(''); setValorPago(''); setMsg('');
    if (id) api.get(`/locacoes/${id}/contexto-cobranca`).then(setCtx).catch((e: any) => setErro(e.message));
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
    setErro(''); setMsg(''); setSalvando(true);
    try {
      const r = await api.post('/cobrancas', {
        locacaoId: ctx.locacao.id,
        contadorAtual: ctx.locacao.regra !== 'VALOR_FIXO' ? Number(contador) : undefined,
        trocaPano,
        pagamento: valorPago ? { valor: Number(valorPago), formaPagamento: forma } : undefined,
      });
      toast('Cobrança registrada!', 'sucesso');
      setMsg(`Saldo atualizado: ${formatarBRL(r.saldoAtualizado)}.`);
      escolherLocacao(ctx.locacao.id);
    } catch (e: any) { setErro(e.message); toast(e.message, 'erro'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Header titulo="Registrar cobrança" subtitulo="Calcule e registre cobranças de locações ativas" />

      <Cartao className="flex flex-col gap-3">
        <Select label="Cliente" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setLocacaoId(''); setCtx(null); }}>
          <option value="">Selecione…</option>
          {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        {clienteId && (
          <Select label="Locação ativa" value={locacaoId} onChange={(e) => escolherLocacao(e.target.value)}>
            <option value="">Selecione…</option>
            {(locacoes ?? []).map((l) => <option key={l.id} value={l.id}>{l.produto?.plaqueta} • {l.regra}</option>)}
          </Select>
        )}
      </Cartao>

      {ctx && (
        <Cartao className="flex flex-col gap-3">
          <p className="text-sm text-suave">Saldo anterior: <span className="valor font-medium text-tinta">{formatarBRL(ctx.saldoAnterior)}</span></p>
          {ctx.locacao.regra !== 'VALOR_FIXO' && (
            <Campo label={`Contador atual (anterior: ${ctx.contadorAnterior})`} inputMode="numeric" value={contador} onChange={(e) => setContador(e.target.value)} />
          )}
          <Campo label="Valor recebido/pago" inputMode="decimal" value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
          <Select label="Forma de pagamento" value={forma} onChange={(e) => setForma(e.target.value)}>
            {['DINHEIRO', 'PIX_MANUAL', 'CARTAO', 'PIX_MERCADO_PAGO'].map((f) => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
          </Select>
          <Checkbox label="Troca de pano" checked={trocaPano} onChange={(e) => setTrocaPano((e.target as HTMLInputElement).checked)} />

          {previsao && (
            <div className="bg-papel rounded-xl p-4 text-sm border border-borda">
              <div className="flex items-center gap-2 mb-2"><Calculator size={16} className="text-latao" /><p className="font-medium">Pré-visualização</p></div>
              {previsao.memorial.map((m: any, i: number) => <p key={i} className="text-suave">{m.rotulo}: {m.valor}</p>)}
              <p className="valor text-lg font-semibold text-feltro mt-2">Líquido: {formatarBRL(previsao.valorLiquidoFinal.toString())}</p>
            </div>
          )}

          {msg && <p className="text-emerald-600 text-sm font-medium">{msg}</p>}
          {erro && <p className="text-alerta text-sm">{erro}</p>}
          <Botao onClick={registrar} loading={salvando} icon={Receipt}>Registrar cobrança</Botao>
        </Cartao>
      )}
    </div>
  );
}
