'use client';
import { useState } from 'react';
import { useApi, useApiPaginated, revalidar } from '@/lib/swr';
import { api } from '@/lib/api';
import { formatarBRL, data as fmtData } from '@/lib/format';
import {
  Botao, Campo, Select, Cartao, Header, Badge, Tabela,
  Paginacao, SkeletonCard, EmptyState, KpiCard, Modal, toast,
} from '@/components/ui/primitives';
import {
  AlertTriangle, CheckCircle2, DollarSign, Clock, Plus,
  CreditCard, Search,
} from 'lucide-react';

/* ─── Status badge ─── */
function SaldoStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cor: string; label: string }> = {
    PENDENTE: { cor: 'bg-amber-100 text-amber-800', label: 'Pendente' },
    QUITADO: { cor: 'bg-emerald-100 text-emerald-800', label: 'Quitado' },
  };
  const s = map[status] ?? map.PENDENTE;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cor}`}>{s.label}</span>;
}

export default function SaldosDevedoresPage() {
  const [clienteId, setClienteId] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [pagina, setPagina] = useState(1);

  // Modal pagamento
  const [pagando, setPagando] = useState<any | null>(null);
  const [valorPag, setValorPag] = useState('');
  const [formaPag, setFormaPag] = useState('DINHEIRO');
  const [salvando, setSalvando] = useState(false);

  const { data: clientes } = useApi<any[]>('/clientes');

  const params = new URLSearchParams();
  if (clienteId) params.set('clienteId', clienteId);
  if (statusFiltro) params.set('status', statusFiltro);
  params.set('pagina', String(pagina));
  params.set('limite', '15');

  const { data: resultado, isLoading } = useApiPaginated<any>(`/saldo-devedor?${params.toString()}`, pagina, 15);
  const saldos = resultado?.itens ?? [];
  const total = resultado?.total ?? 0;

  // Calcular KPIs
  const totalPendente = saldos.reduce((s: number, item: any) => {
    if (item.status === 'PENDENTE') return s + Number(item.valorRestante);
    return s;
  }, 0);
  const totalOriginal = saldos.reduce((s: number, item: any) => s + Number(item.valorOriginal), 0);
  const pendentes = saldos.filter((s: any) => s.status === 'PENDENTE').length;
  const quitados = saldos.filter((s: any) => s.status === 'QUITADO').length;

  async function registrarPagamento() {
    if (!pagando || !valorPag) return;
    setSalvando(true);
    try {
      await api.post(`/saldo-devedor/${pagando.id}/pagar`, {
        valor: Number(valorPag),
        formaPagamento: formaPag,
      });
      revalidar('/saldo-devedor');
      toast('Pagamento registrado!', 'sucesso');
      setPagando(null);
      setValorPag('');
    } catch (e: any) { toast(e.message, 'erro'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Saldos Devedores" subtitulo="Saldos pendentes de locações finalizadas" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total pendente" valor={formatarBRL(totalPendente)} icone={AlertTriangle} cor="amber" subtitulo={`${pendentes} registros`} />
        <KpiCard label="Total original" valor={formatarBRL(totalOriginal)} icone={DollarSign} cor="violet" />
        <KpiCard label="Pendentes" valor={String(pendentes)} icone={Clock} cor="blue" />
        <KpiCard label="Quitados" valor={String(quitados)} icone={CheckCircle2} cor="emerald" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4">
        <Select label="Cliente" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setPagina(1); }}>
          <option value="">Todos</option>
          {(clientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        <Select label="Status" value={statusFiltro} onChange={(e) => { setStatusFiltro(e.target.value); setPagina(1); }}>
          <option value="">Todos</option>
          <option value="PENDENTE">Pendente</option>
          <option value="QUITADO">Quitado</option>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="grid gap-4">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : saldos.length === 0 ? (
        <EmptyState icone={<DollarSign size={48} />} titulo="Nenhum saldo devedor" descricao="Todos os saldos estão quitados ou não há locações finalizadas com saldo pendente." />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <Tabela colunas={['Cliente', 'Produto', 'Original', 'Restante', 'Pagamentos', 'Status', '']}>
              {saldos.map((s: any) => (
                <tr key={s.id} className="hover:bg-papel/50 transition">
                  <td className="px-4 py-3 text-sm font-medium">{s.cliente?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-suave">{s.produtoDescricao ?? s.locacao?.produto?.plaqueta ?? '—'}</td>
                  <td className="px-4 py-3 text-sm valor">{formatarBRL(s.valorOriginal)}</td>
                  <td className="px-4 py-3 text-sm valor font-semibold">{formatarBRL(s.valorRestante)}</td>
                  <td className="px-4 py-3 text-sm text-suave">{s.pagamentos?.length ?? 0}</td>
                  <td className="px-4 py-3"><SaldoStatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">
                    {s.status === 'PENDENTE' && Number(s.valorRestante) > 0 && (
                      <Botao variante="fantasma" tamanho="sm" icon={Plus} onClick={() => { setPagando(s); setValorPag(s.valorRestante.toString()); }}>
                        Pagar
                      </Botao>
                    )}
                  </td>
                </tr>
              ))}
            </Tabela>
          </div>

          {/* Mobile */}
          <div className="md:hidden flex flex-col gap-3">
            {saldos.map((s: any) => (
              <Cartao key={s.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.cliente?.nome ?? '—'}</span>
                  <SaldoStatusBadge status={s.status} />
                </div>
                <p className="text-xs text-suave">{s.produtoDescricao ?? s.locacao?.produto?.plaqueta}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-suave">Restante: <span className="valor font-medium">{formatarBRL(s.valorRestante)}</span></span>
                  {s.status === 'PENDENTE' && Number(s.valorRestante) > 0 && (
                    <Botao variante="fantasma" tamanho="sm" onClick={() => { setPagando(s); setValorPag(s.valorRestante.toString()); }}>Pagar</Botao>
                  )}
                </div>
                {s.pagamentos && s.pagamentos.length > 0 && (
                  <div className="border-t border-borda pt-2 mt-1">
                    <p className="text-xs text-suave mb-1">Último pagamento:</p>
                    <p className="text-xs">{formatarBRL(s.pagamentos[0].valor)} • {fmtData(s.pagamentos[0].dataPagamento)}</p>
                  </div>
                )}
              </Cartao>
            ))}
          </div>

          <Paginacao pagina={pagina} total={total} limite={15} onChange={setPagina} />
        </>
      )}

      {/* Modal de pagamento */}
      {pagando && (
        <Modal aberto={true} aoFechar={() => { setPagando(null); setValorPag(''); }} titulo="Registrar pagamento">
          <div className="flex flex-col gap-4">
            <div className="bg-papel rounded-lg p-3 text-sm">
              <p className="font-medium">{pagando.cliente?.nome}</p>
              <p className="text-suave">{pagando.produtoDescricao}</p>
              <p className="mt-1">Restante: <span className="valor font-semibold">{formatarBRL(pagando.valorRestante)}</span></p>
            </div>
            <Campo label="Valor do pagamento (R$)" inputMode="decimal" value={valorPag} onChange={(e) => setValorPag(e.target.value)} />
            <Select label="Forma de pagamento" value={formaPag} onChange={(e) => setFormaPag(e.target.value)}>
              {['DINHEIRO', 'PIX_MANUAL', 'CARTAO', 'PIX_MERCADO_PAGO'].map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
            </Select>

            {/* Histórico de pagamentos do saldo */}
            {pagando.pagamentos && pagando.pagamentos.length > 0 && (
              <div>
                <p className="text-xs text-suave mb-2 font-medium">Pagamentos anteriores:</p>
                <div className="flex flex-col gap-1.5">
                  {pagando.pagamentos.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-xs bg-papel rounded-lg px-3 py-2">
                      <span>{formatarBRL(p.valor)} • {p.formaPagamento?.replace(/_/g, ' ')}</span>
                      <span className="text-suave">{fmtData(p.dataPagamento)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-2">
              <Botao variante="secundario" onClick={() => { setPagando(null); setValorPag(''); }}>Cancelar</Botao>
              <Botao onClick={registrarPagamento} loading={salvando} disabled={!valorPag} icon={CreditCard}>Registrar</Botao>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
