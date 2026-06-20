'use client';
import { useMemo, useState } from 'react';
import { calcularValorFixo, calcularPercentual } from '@app/core';
import { useApi, revalidar } from '@/lib/swr';
import { api } from '@/lib/api';
import { formatarBRL, data as fmtData } from '@/lib/format';
import {
  Botao, Campo, Select, Checkbox, Cartao, Header, Tabela,
  Paginacao, SkeletonCard, EmptyState, KpiCard, Modal, toast,
} from '@/components/ui/primitives';
import {
  Receipt, Search, Filter, Plus, FileDown, Clock, AlertCircle, CheckCircle2,
  Calculator, DollarSign, ChevronDown, ChevronUp, ArrowLeft,
} from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cor: string; icone: typeof CheckCircle2; label: string }> = {
    PENDENTE: { cor: 'bg-amber-100 text-amber-800', icone: Clock, label: 'Pendente' },
    PARCIAL: { cor: 'bg-blue-100 text-blue-800', icone: AlertCircle, label: 'Parcial' },
    PAGO: { cor: 'bg-emerald-100 text-emerald-800', icone: CheckCircle2, label: 'Pago' },
  };
  const s = map[status] ?? map.PENDENTE;
  const Icon = s.icone;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cor}`}><Icon size={12} />{s.label}</span>;
}

export default function CobrancasPage() {
  const [statusFiltro, setStatusFiltro] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [registrando, setRegistrando] = useState(false);

  const { data: clientes } = useApi<any[]>('/clientes');
  const { data: resumo } = useApi<any>('/cobrancas/resumo' + (clienteId ? `?clienteId=${clienteId}` : ''));

  const params = new URLSearchParams();
  if (statusFiltro) params.set('statusPagamento', statusFiltro);
  if (clienteId) params.set('clienteId', clienteId);
  if (dataInicio) params.set('dataInicio', dataInicio);
  if (dataFim) params.set('dataFim', dataFim);
  params.set('pagina', String(pagina));
  params.set('limite', '15');

  const { data: resultado, isLoading } = useApi<any>(`/cobrancas?${params.toString()}`);
  const todas: any[] = Array.isArray(resultado) ? resultado : (resultado?.itens ?? []);
  const total = Array.isArray(resultado) ? resultado.length : (resultado?.total ?? 0);

  // Busca local por cliente OU plaqueta (dentro da página carregada).
  const q = busca.trim().toLowerCase();
  const cobrancas = q
    ? todas.filter((c) => (c.locacao?.cliente?.nome ?? '').toLowerCase().includes(q) || (c.locacao?.produto?.plaqueta ?? '').toLowerCase().includes(q))
    : todas;

  function limparFiltros() { setStatusFiltro(''); setClienteId(''); setBusca(''); setDataInicio(''); setDataFim(''); setPagina(1); }

  async function exportarCSV() {
    try {
      const r = await api.get(`/cobrancas?limite=9999${clienteId ? `&clienteId=${clienteId}` : ''}${statusFiltro ? `&statusPagamento=${statusFiltro}` : ''}`);
      const linhas = [
        'Data,Cliente,Produto,Regra,Valor Líquido,Status,Pago',
        ...(r.itens ?? []).map((c: any) =>
          [fmtData(c.dataCobranca), c.locacao?.cliente?.nome, c.locacao?.produto?.plaqueta, c.regraSnapshot, Number(c.valorLiquidoFinal).toFixed(2), c.statusPagamento, (c.pagamentos ?? []).reduce((s: number, p: any) => s + Number(p.valor), 0).toFixed(2)].join(',')),
      ];
      const blob = new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `cobrancas_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast('CSV exportado!', 'sucesso');
    } catch (e: any) { toast(e.message, 'erro'); }
  }

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Cobranças" subtitulo="Cobranças, pagamentos e histórico financeiro" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pendente" valor={formatarBRL(resumo?.totais?.pendente?.valor ?? 0)} icone={Clock} cor="amber" />
        <KpiCard label="Parcial" valor={formatarBRL(resumo?.totais?.parcial?.valor ?? 0)} icone={AlertCircle} cor="blue" />
        <KpiCard label="Pago" valor={formatarBRL(resumo?.totais?.pago?.valor ?? 0)} icone={CheckCircle2} cor="emerald" />
        <KpiCard label="Total recebido" valor={formatarBRL(resumo?.totais?.totalRecebido ?? 0)} icone={DollarSign} cor="violet" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <input type="text" placeholder="Buscar por cliente ou plaqueta..." value={busca} onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-borda rounded-xl text-sm bg-white focus:border-latao focus:ring-latao/20" />
        </div>
        <Botao variante="secundario" tamanho="sm" icon={Filter} onClick={() => setMostrarFiltros(!mostrarFiltros)}>
          Filtros {mostrarFiltros ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Botao>
        <Botao variante="secundario" tamanho="sm" icon={FileDown} onClick={exportarCSV}>Exportar</Botao>
        <Botao tamanho="sm" icon={Plus} onClick={() => setRegistrando(true)}>Nova cobrança</Botao>
      </div>

      {mostrarFiltros && (
        <Cartao className="flex flex-wrap items-end gap-4">
          <Select label="Status" value={statusFiltro} onChange={(e) => { setStatusFiltro(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>
            <option value="PENDENTE">Pendente</option>
            <option value="PARCIAL">Parcial</option>
            <option value="PAGO">Pago</option>
          </Select>
          <Select label="Cliente" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>
            {(clientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
          <Campo label="Data início" type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPagina(1); }} />
          <Campo label="Data fim" type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPagina(1); }} />
          <Botao variante="fantasma" tamanho="sm" onClick={limparFiltros}>Limpar</Botao>
        </Cartao>
      )}

      {isLoading ? (
        <div className="grid gap-4">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : cobrancas.length === 0 ? (
        <EmptyState icone={<Receipt size={48} />} titulo="Nenhuma cobrança encontrada" descricao="Registre a primeira cobrança ou ajuste os filtros." />
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <Tabela colunas={['Data', 'Cliente', 'Produto', 'Regra', 'Valor', 'Pago', 'Status', '']}>
              {cobrancas.map((c: any) => {
                const totalPago = (c.pagamentos ?? []).reduce((s: number, p: any) => s + Number(p.valor), 0);
                return (
                  <tr key={c.id} className="hover:bg-papel/50 transition cursor-pointer" onClick={() => (window.location.href = `/cobrancas/${c.id}`)}>
                    <td className="px-4 py-3 text-sm">{fmtData(c.dataCobranca)}</td>
                    <td className="px-4 py-3 text-sm font-medium">{c.locacao?.cliente?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-sm valor">{c.locacao?.produto?.plaqueta ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-suave">{c.regraSnapshot?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-sm valor">{formatarBRL(c.valorLiquidoFinal)}</td>
                    <td className="px-4 py-3 text-sm valor">{formatarBRL(totalPago)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.statusPagamento} /></td>
                    <td className="px-4 py-3 text-right text-xs text-feltro">Detalhes →</td>
                  </tr>
                );
              })}
            </Tabela>
          </div>

          <div className="md:hidden flex flex-col gap-3">
            {cobrancas.map((c: any) => {
              const totalPago = (c.pagamentos ?? []).reduce((s: number, p: any) => s + Number(p.valor), 0);
              return (
                <Cartao key={c.id} className="flex flex-col gap-2 cursor-pointer" onClick={() => (window.location.href = `/cobrancas/${c.id}`)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.locacao?.cliente?.nome ?? '—'}</span>
                    <StatusBadge status={c.statusPagamento} />
                  </div>
                  <div className="flex items-center justify-between text-sm text-suave">
                    <span>{c.locacao?.produto?.plaqueta} • {fmtData(c.dataCobranca)}</span>
                    <span className="valor font-medium">{formatarBRL(c.valorLiquidoFinal)}</span>
                  </div>
                  {totalPago > 0 && <p className="text-xs text-emerald-600">Pago: {formatarBRL(totalPago)}</p>}
                </Cartao>
              );
            })}
          </div>

          {!q && <Paginacao pagina={pagina} total={total} limite={15} onChange={setPagina} />}
        </>
      )}

      {registrando && <ModalRegistro onClose={() => setRegistrando(false)} clientes={clientes ?? []} />}
    </div>
  );
}

/* ─── Modal de Registro de Cobrança (2 etapas: dados → confirmação) ─── */
function ModalRegistro({ onClose, clientes }: { onClose: () => void; clientes: any[] }) {
  const [etapa, setEtapa] = useState<'form' | 'confirmar'>('form');
  const [clienteId, setClienteId] = useState('');
  const [locacaoId, setLocacaoId] = useState('');
  const [ctx, setCtx] = useState<any | null>(null);

  const [contador, setContador] = useState('');
  const [contadorReiniciado, setContadorReiniciado] = useState(false);
  const [acrescimo, setAcrescimo] = useState('');
  const [descontoPartidas, setDescontoPartidas] = useState('');
  const [descontoValor, setDescontoValor] = useState('');
  const [valorPago, setValorPago] = useState('');
  const [forma, setForma] = useState('DINHEIRO');
  const [trocaPano, setTrocaPano] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Só locações ATIVAS podem ser cobradas (saldos finalizados ficam na área de Saldos Devedores).
  const { data: locRaw } = useApi<any>(clienteId ? `/locacoes?clienteId=${clienteId}&status=ATIVA&limite=1000` : null);
  const locacoes: any[] = (Array.isArray(locRaw) ? locRaw : (locRaw?.itens ?? [])).filter((l: any) => l.status === 'ATIVA');

  function escolherLocacao(id: string) {
    setLocacaoId(id); setCtx(null); setContador(''); setValorPago(''); setSucesso(''); setErro('');
    setContadorReiniciado(false); setDescontoPartidas(''); setDescontoValor(''); setAcrescimo(''); setTrocaPano(false);
    if (id) api.get(`/locacoes/${id}/contexto-cobranca`).then(setCtx).catch((e: any) => setErro(e.message));
  }

  const ehPercentual = ctx && ctx.locacao.regra !== 'VALOR_FIXO';
  const ehAReceber = ctx && ctx.locacao.regra === 'PERCENTUAL_A_RECEBER';

  const previsao = useMemo(() => {
    if (!ctx) return null;
    const l = ctx.locacao;
    try {
      if (l.regra === 'VALOR_FIXO') {
        return calcularValorFixo({
          valorFixo: l.valorFixo, frequencia: l.frequencia,
          dataReferencia: new Date(ctx.dataReferencia), hoje: new Date(),
          acrescimo: Number(acrescimo) || 0, saldoAnterior: ctx.saldoAnterior,
        });
      }
      if (!contador && !contadorReiniciado) return null;
      return calcularPercentual({
        regra: l.regra, contadorAnterior: ctx.contadorAnterior,
        contadorAtual: Number(contador) || 0, contadorReiniciado,
        valorPartida: l.valorPartida, percentual: l.percentual,
        descontoPartidas: Number(descontoPartidas) || 0,
        descontoValorReceber: ehAReceber ? (Number(descontoValor) || 0) : 0,
        acrescimo: Number(acrescimo) || 0, saldoAnterior: ctx.saldoAnterior,
      });
    } catch (e: any) { return { erro: e.message }; }
  }, [ctx, contador, contadorReiniciado, acrescimo, descontoPartidas, descontoValor, ehAReceber]);

  const previsaoOk = previsao && !('erro' in previsao);
  const liquido = previsaoOk ? Number((previsao as any).valorLiquidoFinal.toString()) : 0;
  const pago = Number(valorPago) || 0;
  const novoSaldo = liquido - pago;

  async function registrar() {
    setErro(''); setSucesso(''); setSalvando(true);
    try {
      const r = await api.post('/cobrancas', {
        locacaoId: ctx.locacao.id,
        contadorAtual: ehPercentual ? Number(contador) || 0 : undefined,
        contadorReiniciado: ehPercentual ? contadorReiniciado : undefined,
        descontoPartidas: ehPercentual && descontoPartidas ? Number(descontoPartidas) : undefined,
        descontoValorReceber: ehAReceber && descontoValor ? Number(descontoValor) : undefined,
        acrescimo: acrescimo ? Number(acrescimo) : undefined,
        trocaPano,
        pagamento: valorPago ? { valor: Number(valorPago), formaPagamento: forma } : undefined,
      });
      revalidar('/cobrancas');
      toast('Cobrança registrada!', 'sucesso');
      setSucesso(`Cobrança registrada. Saldo atualizado: ${formatarBRL(r.saldoAtualizado ?? novoSaldo)}`);
      setEtapa('form');
      escolherLocacao(ctx.locacao.id);
    } catch (e: any) { setErro(e.message); toast(e.message, 'erro'); setEtapa('form'); }
    finally { setSalvando(false); }
  }

  const podeRevisar = !!ctx && previsaoOk && (!ehPercentual || contador !== '' || contadorReiniciado);

  return (
    <Modal aberto={true} aoFechar={onClose} titulo={etapa === 'form' ? 'Registrar cobrança' : 'Confirmar cobrança'} tamanho="lg">
      {etapa === 'form' ? (
        <div className="flex flex-col gap-4 max-h-[72vh] overflow-y-auto pr-1">
          {/* 1. Seleção */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Cliente" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setLocacaoId(''); setCtx(null); }}>
              <option value="">Selecione…</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
            {clienteId && (
              <Select label="Locação ativa" value={locacaoId} onChange={(e) => escolherLocacao(e.target.value)}>
                <option value="">{locacoes.length ? 'Selecione…' : 'Sem locações ativas'}</option>
                {locacoes.map((l) => <option key={l.id} value={l.id}>{l.produto?.plaqueta} • {l.regra?.replace(/_/g, ' ')}</option>)}
              </Select>
            )}
          </div>

          {ctx && (
            <>
              <div className="bg-papel rounded-lg p-3 text-sm flex items-center justify-between">
                <span className="text-suave">Saldo anterior</span>
                <span className="valor font-medium text-tinta">{formatarBRL(ctx.saldoAnterior)}</span>
              </div>

              {/* 2. Medição / contador */}
              {ehPercentual && (
                <div className="flex flex-col gap-3 border border-borda rounded-xl p-3">
                  <p className="text-xs font-medium text-suave uppercase tracking-wide">Contador</p>
                  <Campo label={`Contador atual (anterior: ${ctx.contadorAnterior})`} inputMode="numeric" value={contador} onChange={(e) => setContador(e.target.value)} />
                  <Checkbox label="Contador foi reiniciado/trocado" checked={contadorReiniciado} onChange={(e) => setContadorReiniciado((e.target as HTMLInputElement).checked)} />
                </div>
              )}

              {/* 3. Ajustes e descontos */}
              <div className="flex flex-col gap-3 border border-borda rounded-xl p-3">
                <p className="text-xs font-medium text-suave uppercase tracking-wide">Ajustes</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label="Acréscimo (R$)" inputMode="decimal" value={acrescimo} onChange={(e) => setAcrescimo(e.target.value)} />
                  {ehPercentual && <Campo label="Desconto de partidas (qtd)" inputMode="numeric" value={descontoPartidas} onChange={(e) => setDescontoPartidas(e.target.value)} />}
                  {ehAReceber && <Campo label="Desconto no valor (R$)" inputMode="decimal" value={descontoValor} onChange={(e) => setDescontoValor(e.target.value)} />}
                </div>
                <Checkbox label="Troca de pano" checked={trocaPano} onChange={(e) => setTrocaPano((e.target as HTMLInputElement).checked)} />
              </div>

              {/* 4. Pagamento (opcional) */}
              <div className="flex flex-col gap-3 border border-borda rounded-xl p-3">
                <p className="text-xs font-medium text-suave uppercase tracking-wide">Pagamento (opcional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label="Valor pago/recebido (R$)" inputMode="decimal" value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
                  {valorPago && (
                    <Select label="Forma" value={forma} onChange={(e) => setForma(e.target.value)}>
                      {['DINHEIRO', 'PIX_MANUAL', 'CARTAO', 'PIX_MERCADO_PAGO'].map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                    </Select>
                  )}
                </div>
              </div>

              {/* Pré-visualização */}
              {previsao && 'erro' in previsao ? (
                <p className="text-alerta text-sm">{(previsao as any).erro}</p>
              ) : previsaoOk && (
                <div className="bg-feltro/5 rounded-xl p-4 text-sm border border-feltro/10">
                  <div className="flex items-center gap-2 mb-2"><Calculator size={16} className="text-latao" /><p className="font-medium">Pré-visualização</p></div>
                  {(previsao as any).memorial.map((m: any, i: number) => <div key={i} className="flex justify-between text-suave"><span>{m.rotulo}</span><span className="valor">{m.valor}</span></div>)}
                  <p className="valor text-lg font-semibold text-feltro mt-2 pt-2 border-t border-feltro/10 flex justify-between"><span>Líquido</span><span>{formatarBRL(liquido)}</span></p>
                </div>
              )}
            </>
          )}

          {sucesso && <p className="text-emerald-600 text-sm font-medium">{sucesso}</p>}
          {erro && <p className="text-alerta text-sm">{erro}</p>}
          <div className="flex gap-2 justify-end pt-2 border-t border-borda">
            <Botao variante="secundario" onClick={onClose}>Fechar</Botao>
            <Botao onClick={() => setEtapa('confirmar')} disabled={!podeRevisar} icon={Receipt}>Revisar</Botao>
          </div>
        </div>
      ) : (
        // ── Etapa de confirmação ──
        <div className="flex flex-col gap-4">
          <div className="bg-papel rounded-xl p-4 text-sm">
            <div className="flex justify-between mb-1"><span className="text-suave">Cliente</span><span className="font-medium">{clientes.find((c) => c.id === clienteId)?.nome}</span></div>
            <div className="flex justify-between mb-1"><span className="text-suave">Produto</span><span className="font-medium valor">{ctx?.locacao?.produto?.plaqueta ?? locacoes.find((l) => l.id === locacaoId)?.produto?.plaqueta}</span></div>
            <div className="flex justify-between"><span className="text-suave">Regra</span><span>{ctx?.locacao?.regra?.replace(/_/g, ' ')}</span></div>
          </div>

          <div className="border border-borda rounded-xl p-4 text-sm">
            <p className="font-medium mb-2 flex items-center gap-2"><Calculator size={16} className="text-latao" />Memorial de cálculo</p>
            {previsaoOk && (previsao as any).memorial.map((m: any, i: number) => (
              <div key={i} className="flex justify-between text-suave py-0.5"><span>{m.rotulo}</span><span className="valor">{m.valor}</span></div>
            ))}
            <div className="flex justify-between font-semibold text-feltro mt-2 pt-2 border-t border-borda"><span>Valor líquido</span><span className="valor">{formatarBRL(liquido)}</span></div>
            {trocaPano && <p className="text-xs text-amber-600 mt-2">⚠ Troca de pano será registrada</p>}
          </div>

          <div className="border border-borda rounded-xl p-4 text-sm">
            <p className="font-medium mb-2">Pagamento</p>
            {pago > 0 ? (
              <>
                <div className="flex justify-between py-0.5"><span className="text-suave">Valor pago</span><span className="valor text-emerald-600">{formatarBRL(pago)}</span></div>
                <div className="flex justify-between py-0.5"><span className="text-suave">Forma</span><span>{forma.replace(/_/g, ' ')}</span></div>
                <div className="flex justify-between font-medium mt-2 pt-2 border-t border-borda"><span>Saldo após pagamento</span><span className={`valor ${novoSaldo > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatarBRL(novoSaldo)}</span></div>
              </>
            ) : (
              <p className="text-suave">Sem pagamento — a cobrança ficará pendente (saldo {formatarBRL(liquido)}).</p>
            )}
          </div>

          {erro && <p className="text-alerta text-sm">{erro}</p>}
          <div className="flex gap-2 justify-between pt-2 border-t border-borda">
            <Botao variante="fantasma" icon={ArrowLeft} onClick={() => setEtapa('form')} disabled={salvando}>Voltar</Botao>
            <Botao onClick={registrar} loading={salvando} icon={CheckCircle2}>Confirmar e registrar</Botao>
          </div>
        </div>
      )}
    </Modal>
  );
}
