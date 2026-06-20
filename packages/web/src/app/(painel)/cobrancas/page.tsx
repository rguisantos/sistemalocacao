'use client';
import { useMemo, useState } from 'react';
import { calcularValorFixo, calcularPercentual } from '@app/core';
import { useApi, useApiPaginated, revalidar } from '@/lib/swr';
import { api } from '@/lib/api';
import { formatarBRL, data as fmtData } from '@/lib/format';
import {
  Botao, Campo, Select, Checkbox, Cartao, Header, Badge, Tabela,
  Paginacao, SkeletonCard, EmptyState, KpiCard, Modal, toast,
} from '@/components/ui/primitives';
import {
  Receipt, Search, Filter, Plus, FileDown, Clock, AlertCircle, CheckCircle2,
  Calculator, DollarSign, CreditCard, ChevronDown, ChevronUp,
} from 'lucide-react';

/* ─── Badge de status ─── */
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

/* ─── Página principal ─── */
export default function CobrancasPage() {
  // Filtros
  const [statusFiltro, setStatusFiltro] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [pagina, setPagina] = useState(1);

  // Modal registro
  const [registrando, setRegistrando] = useState(false);

  // Dados
  const { data: clientes } = useApi<any[]>('/clientes');
  const { data: resumo } = useApi<any>('/cobrancas/resumo' + (clienteId ? `?clienteId=${clienteId}` : ''));

  const params = new URLSearchParams();
  if (statusFiltro) params.set('statusPagamento', statusFiltro);
  if (clienteId) params.set('clienteId', clienteId);
  if (dataInicio) params.set('dataInicio', dataInicio);
  if (dataFim) params.set('dataFim', dataFim);
  params.set('pagina', String(pagina));
  params.set('limite', '15');
  const qs = params.toString();

  const { data: resultado, isLoading } = useApi<any>(`/cobrancas?${qs}`);
  // Suporta API nova (paginada {itens, total}) e antiga (objeto erro ou sem suporte)
  const cobrancas: any[] = Array.isArray(resultado) ? resultado : (resultado?.itens ?? []);
  const total = Array.isArray(resultado) ? resultado.length : (resultado?.total ?? 0);

  function limparFiltros() {
    setStatusFiltro(''); setClienteId(''); setBusca('');
    setDataInicio(''); setDataFim(''); setPagina(1);
  }

  // CSV export
  async function exportarCSV() {
    try {
      const todos = await api.get(`/cobrancas?limite=9999${clienteId ? `&clienteId=${clienteId}` : ''}${statusFiltro ? `&statusPagamento=${statusFiltro}` : ''}`);
      const linhas = [
        'Data,Cliente,Produto,Regra,Valor Líquido,Status,Pago',
        ...(todos.itens ?? []).map((c: any) =>
          [fmtData(c.dataCobranca), c.locacao?.cliente?.nome, c.locacao?.produto?.plaqueta, c.regraSnapshot, Number(c.valorLiquidoFinal).toFixed(2), c.statusPagamento, c.pagamentos?.reduce((s: number, p: any) => s + Number(p.valor), 0).toFixed(2)].join(',')
        ),
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
      <Header titulo="Cobranças" subtitulo="Gerencie cobranças, pagamentos e histórico financeiro" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pendente" valor={formatarBRL(resumo?.totais?.pendente?.valor ?? 0)} icone={Clock} cor="amber" />
        <KpiCard label="Parcial" valor={formatarBRL(resumo?.totais?.parcial?.valor ?? 0)} icone={AlertCircle} cor="blue" />
        <KpiCard label="Pago" valor={formatarBRL(resumo?.totais?.pago?.valor ?? 0)} icone={CheckCircle2} cor="emerald" />
        <KpiCard label="Total recebido" valor={formatarBRL(resumo?.totais?.totalRecebido ?? 0)} icone={DollarSign} cor="violet" />
      </div>

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <input
            type="text" placeholder="Buscar cobrança..." value={busca} onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-borda rounded-xl text-sm bg-white focus:border-latao focus:ring-latao/20"
          />
        </div>
        <Botao variante="secundario" tamanho="sm" icon={Filter} onClick={() => setMostrarFiltros(!mostrarFiltros)}>
          Filtros {mostrarFiltros ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Botao>
        <Botao variante="secundario" tamanho="sm" icon={FileDown} onClick={exportarCSV}>Exportar</Botao>
        <Botao tamanho="sm" icon={Plus} onClick={() => setRegistrando(true)}>Nova cobrança</Botao>
      </div>

      {/* Filtros expansíveis */}
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

      {/* Tabela de cobranças */}
      {isLoading ? (
        <div className="grid gap-4">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : cobrancas.length === 0 ? (
        <EmptyState icone={<Receipt size={48} />} titulo="Nenhuma cobrança encontrada" descricao="Registre a primeira cobrança ou ajuste os filtros." />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <Tabela colunas={['Data', 'Cliente', 'Produto', 'Regra', 'Valor', 'Pago', 'Status', '']}>
              {cobrancas.map((c: any) => {
                const totalPago = c.pagamentos?.reduce((s: number, p: any) => s + Number(p.valor), 0) ?? 0;
                return (
                  <tr key={c.id} className="hover:bg-papel/50 transition">
                    <td className="px-4 py-3 text-sm">{fmtData(c.dataCobranca)}</td>
                    <td className="px-4 py-3 text-sm font-medium">{c.locacao?.cliente?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-sm">{c.locacao?.produto?.plaqueta ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-suave">{c.regraSnapshot?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-sm valor">{formatarBRL(c.valorLiquidoFinal)}</td>
                    <td className="px-4 py-3 text-sm valor">{formatarBRL(totalPago)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.statusPagamento} /></td>
                    <td className="px-4 py-3">
                      <Botao variante="fantasma" tamanho="sm" onClick={() => window.location.href = `/cobrancas/${c.id}`}>Detalhes</Botao>
                    </td>
                  </tr>
                );
              })}
            </Tabela>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-3">
            {cobrancas.map((c: any) => {
              const totalPago = c.pagamentos?.reduce((s: number, p: any) => s + Number(p.valor), 0) ?? 0;
              return (
                <Cartao key={c.id} className="flex flex-col gap-2 cursor-pointer" onClick={() => window.location.href = `/cobrancas/${c.id}`}>
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

          <Paginacao pagina={pagina} total={total} limite={15} onChange={setPagina} />
        </>
      )}

      {/* Modal de registro */}
      {registrando && <ModalRegistro onClose={() => setRegistrando(false)} clientes={clientes ?? []} />}
    </div>
  );
}

/* ─── Modal de Registro de Cobrança ─── */
function ModalRegistro({ onClose, clientes }: { onClose: () => void; clientes: any[] }) {
  const [clienteId, setClienteId] = useState('');
  const [locacaoId, setLocacaoId] = useState('');
  const [ctx, setCtx] = useState<any | null>(null);
  const [contador, setContador] = useState('');
  const [valorPago, setValorPago] = useState('');
  const [forma, setForma] = useState('DINHEIRO');
  const [trocaPano, setTrocaPano] = useState(false);
  const [acrescimo, setAcrescimo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const { data: locacoes } = useApi<any[]>(clienteId ? `/locacoes?clienteId=${clienteId}` : null);

  function escolherLocacao(id: string) {
    setLocacaoId(id); setCtx(null); setContador(''); setValorPago(''); setSucesso('');
    if (id) api.get(`/locacoes/${id}/contexto-cobranca`).then(setCtx).catch((e: any) => setErro(e.message));
  }

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
      if (!contador) return null;
      return calcularPercentual({
        regra: l.regra, contadorAnterior: ctx.contadorAnterior,
        contadorAtual: Number(contador), valorPartida: l.valorPartida,
        percentual: l.percentual, saldoAnterior: ctx.saldoAnterior,
      });
    } catch { return null; }
  }, [ctx, contador, acrescimo]);

  async function registrar() {
    setErro(''); setSucesso(''); setSalvando(true);
    try {
      const r = await api.post('/cobrancas', {
        locacaoId: ctx.locacao.id,
        contadorAtual: ctx.locacao.regra !== 'VALOR_FIXO' ? Number(contador) : undefined,
        acrescimo: Number(acrescimo) || undefined,
        trocaPano,
        pagamento: valorPago ? { valor: Number(valorPago), formaPagamento: forma } : undefined,
      });
      revalidar('/cobrancas');
      toast('Cobrança registrada!', 'sucesso');
      setSucesso(`Saldo atualizado: ${formatarBRL(r.saldoAtualizado)}`);
      escolherLocacao(ctx.locacao.id);
    } catch (e: any) { setErro(e.message); toast(e.message, 'erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto={true} aoFechar={onClose} titulo="Registrar cobrança">
      <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-1">
        <Select label="Cliente" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setLocacaoId(''); setCtx(null); }}>
          <option value="">Selecione…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        {clienteId && (
          <Select label="Locação ativa" value={locacaoId} onChange={(e) => escolherLocacao(e.target.value)}>
            <option value="">Selecione…</option>
            {(locacoes ?? []).map((l) => <option key={l.id} value={l.id}>{l.produto?.plaqueta} • {l.regra?.replace(/_/g, ' ')}</option>)}
          </Select>
        )}
        {ctx && (
          <>
            <div className="bg-papel rounded-lg p-3 text-sm">
              <p className="text-suave">Saldo anterior: <span className="valor font-medium text-tinta">{formatarBRL(ctx.saldoAnterior)}</span></p>
            </div>
            {ctx.locacao.regra !== 'VALOR_FIXO' && (
              <Campo label={`Contador atual (anterior: ${ctx.contadorAnterior})`} inputMode="numeric" value={contador} onChange={(e) => setContador(e.target.value)} />
            )}
            <Campo label="Acréscimo (R$)" inputMode="decimal" value={acrescimo} onChange={(e) => setAcrescimo(e.target.value)} />
            <Campo label="Valor pago/recebido" inputMode="decimal" value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
            {valorPago && (
              <Select label="Forma de pagamento" value={forma} onChange={(e) => setForma(e.target.value)}>
                {['DINHEIRO', 'PIX_MANUAL', 'CARTAO', 'PIX_MERCADO_PAGO'].map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
              </Select>
            )}
            <Checkbox label="Troca de pano" checked={trocaPano} onChange={(e) => setTrocaPano((e.target as HTMLInputElement).checked)} />
            {previsao && (
              <div className="bg-papel rounded-xl p-4 text-sm border border-borda">
                <div className="flex items-center gap-2 mb-2"><Calculator size={16} className="text-latao" /><p className="font-medium">Pré-visualização</p></div>
                {previsao.memorial.map((m: any, i: number) => <p key={i} className="text-suave">{m.rotulo}: {m.valor}</p>)}
                <p className="valor text-lg font-semibold text-feltro mt-2">Líquido: {formatarBRL(previsao.valorLiquidoFinal.toString())}</p>
              </div>
            )}
          </>
        )}
        {sucesso && <p className="text-emerald-600 text-sm font-medium">{sucesso}</p>}
        {erro && <p className="text-alerta text-sm">{erro}</p>}
        <div className="flex gap-2 justify-end">
          <Botao variante="secundario" onClick={onClose}>Cancelar</Botao>
          <Botao onClick={registrar} loading={salvando} disabled={!ctx} icon={Receipt}>Registrar</Botao>
        </div>
      </div>
    </Modal>
  );
}
