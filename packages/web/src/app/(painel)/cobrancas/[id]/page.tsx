'use client';
import { useApi } from '@/lib/swr';
import { api } from '@/lib/api';
import { formatarBRL, data as fmtData } from '@/lib/format';
import {
  Botao, Cartao, Header, Badge, SkeletonCard, EmptyState, toast,
} from '@/components/ui/primitives';
import {
  ArrowLeft, Receipt, Clock, CheckCircle2, AlertCircle, Calculator,
  CreditCard, Wrench, MapPin, User, Calendar, Tag,
} from 'lucide-react';
import Link from 'next/link';

/* ─── Status badge ─── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cor: string; icone: typeof CheckCircle2; label: string }> = {
    PENDENTE: { cor: 'bg-amber-100 text-amber-800', icone: Clock, label: 'Pendente' },
    PARCIAL: { cor: 'bg-blue-100 text-blue-800', icone: AlertCircle, label: 'Parcial' },
    PAGO: { cor: 'bg-emerald-100 text-emerald-800', icone: CheckCircle2, label: 'Pago' },
  };
  const s = map[status] ?? map.PENDENTE;
  const Icon = s.icone;
  return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${s.cor}`}><Icon size={14} />{s.label}</span>;
}

/* ─── Forma de pagamento label ─── */
function FormaLabel({ forma }: { forma: string }) {
  const map: Record<string, string> = {
    DINHEIRO: '💵 Dinheiro',
    PIX_MANUAL: '📱 PIX Manual',
    CARTAO: '💳 Cartão',
    PIX_MERCADO_PAGO: '📱 PIX Mercado Pago',
  };
  return <span>{map[forma] ?? forma}</span>;
}

export default function CobrancaDetalhePage({ params }: { params: { id: string } }) {
  const { data, isLoading, error } = useApi<any>(`/cobrancas/${params.id}`);

  if (isLoading) return <div className="flex flex-col gap-6"><SkeletonCard /><SkeletonCard /></div>;
  if (error || !data) return <EmptyState icone={<Receipt size={48} />} titulo="Cobrança não encontrada" descricao="Verifique o ID e tente novamente." />;

  const { cobranca, memorial, historicoLocacao } = data;
  const totalPago = cobranca.pagamentos?.reduce((s: number, p: any) => s + Number(p.valor), 0) ?? 0;
  const valorPendente = Math.max(0, Number(cobranca.valorLiquidoFinal) - totalPago);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/cobrancas"><Botao variante="fantasma" tamanho="sm" icon={ArrowLeft}>Voltar</Botao></Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">Cobrança</h1>
          <p className="text-suave text-sm mt-1">
            <Calendar size={14} className="inline mr-1" />
            {fmtData(cobranca.dataCobranca)} • {cobranca.regraSnapshot?.replace(/_/g, ' ')}
          </p>
        </div>
        <StatusBadge status={cobranca.statusPagamento} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Cartao className="p-4">
          <p className="text-xs text-suave uppercase tracking-wide mb-1">Valor líquido</p>
          <p className="valor text-xl font-bold">{formatarBRL(cobranca.valorLiquidoFinal)}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-suave uppercase tracking-wide mb-1">Total pago</p>
          <p className="valor text-xl font-bold text-emerald-600">{formatarBRL(totalPago)}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-suave uppercase tracking-wide mb-1">Pendente</p>
          <p className="valor text-xl font-bold text-amber-600">{formatarBRL(valorPendente)}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-suave uppercase tracking-wide mb-1">Saldo anterior</p>
          <p className="valor text-xl font-bold">{formatarBRL(cobranca.saldoDevedorAnterior)}</p>
        </Cartao>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coluna 1: Informações */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Cliente */}
          <Cartao className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <User size={16} className="text-latao" />
              <h3 className="font-semibold text-sm">Cliente</h3>
            </div>
            <Link href={`/clientes/${cobranca.locacao?.cliente?.id}`} className="text-feltro hover:underline font-medium">
              {cobranca.locacao?.cliente?.nome}
            </Link>
            {cobranca.locacao?.cliente?.telefones && Array.isArray(cobranca.locacao.cliente.telefones) && cobranca.locacao.cliente.telefones.length > 0 && (
              <p className="text-xs text-suave mt-1">{cobranca.locacao.cliente.telefones[0]}</p>
            )}
          </Cartao>

          {/* Produto */}
          <Cartao className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={16} className="text-latao" />
              <h3 className="font-semibold text-sm">Produto / Locação</h3>
            </div>
            <p className="font-medium">{cobranca.locacao?.produto?.plaqueta}</p>
            {cobranca.locacao?.produto?.descricao && <p className="text-xs text-suave">{cobranca.locacao.produto.descricao}</p>}
          </Cartao>

          {/* Endereço */}
          {cobranca.locacao?.endereco && (
            <Cartao className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={16} className="text-latao" />
                <h3 className="font-semibold text-sm">Endereço</h3>
              </div>
              <p className="text-sm">{cobranca.locacao.endereco.logradouro}{cobranca.locacao.endereco.numero ? `, ${cobranca.locacao.endereco.numero}` : ''}</p>
              <p className="text-xs text-suave">{cobranca.locacao.endereco.bairro} • {cobranca.locacao.endereco.cidade}</p>
            </Cartao>
          )}

          {/* Registrado por */}
          <Cartao className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <User size={16} className="text-latao" />
              <h3 className="font-semibold text-sm">Registrado por</h3>
            </div>
            <p className="text-sm">{cobranca.usuario?.nome ?? '—'}</p>
          </Cartao>

          {/* Troca de pano */}
          {cobranca.trocaPano && (
            <Cartao className="p-4 border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-amber-600" />
                <p className="font-medium text-sm text-amber-800">Troca de pano registrada</p>
              </div>
            </Cartao>
          )}
        </div>

        {/* Coluna 2: Memorial de cálculo */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Cartao className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={16} className="text-latao" />
              <h3 className="font-semibold">Memorial de cálculo</h3>
            </div>
            <div className="flex flex-col gap-2">
              {memorial?.map((m: any, i: number) => (
                <div key={i} className={`flex justify-between text-sm ${i === memorial.length - 1 ? 'pt-2 border-t border-borda font-semibold text-feltro' : ''}`}>
                  <span className="text-suave">{m.rotulo}</span>
                  <span className="valor">{m.valor}</span>
                </div>
              ))}
            </div>
          </Cartao>

          {/* Contadores (percentual) */}
          {(cobranca.contadorAnterior != null || cobranca.contadorAtual != null) && (
            <Cartao className="p-4">
              <h3 className="font-semibold text-sm mb-3">Contadores</h3>
              <div className="flex justify-between text-sm">
                <span className="text-suave">Anterior</span>
                <span>{cobranca.contadorAnterior ?? '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-suave">Atual</span>
                <span>{cobranca.contadorAtual ?? '—'}</span>
              </div>
              {cobranca.partidasJogadas != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-suave">Partidas jogadas</span>
                  <span>{cobranca.partidasJogadas}</span>
                </div>
              )}
              {cobranca.partidasConsideradas != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-suave">Partidas consideradas</span>
                  <span>{cobranca.partidasConsideradas}</span>
                </div>
              )}
              {cobranca.descontoPartidas > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-suave">Desconto partidas</span>
                  <span>{cobranca.descontoPartidas}</span>
                </div>
              )}
              {cobranca.contadorReiniciado && (
                <p className="text-xs text-amber-600 mt-2">⚠ Contador reiniciado</p>
              )}
            </Cartao>
          )}
        </div>

        {/* Coluna 3: Pagamentos e histórico */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Pagamentos */}
          <Cartao className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={16} className="text-latao" />
              <h3 className="font-semibold">Pagamentos ({cobranca.pagamentos?.length ?? 0})</h3>
            </div>
            {(!cobranca.pagamentos || cobranca.pagamentos.length === 0) ? (
              <p className="text-sm text-suave">Nenhum pagamento registrado.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {cobranca.pagamentos.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-borda last:border-0">
                    <div>
                      <p className="text-sm font-medium valor">{formatarBRL(p.valor)}</p>
                      <p className="text-xs text-suave"><FormaLabel forma={p.formaPagamento} /></p>
                    </div>
                    <span className="text-xs text-suave">{fmtData(p.dataPagamento)}</span>
                  </div>
                ))}
              </div>
            )}
          </Cartao>

          {/* Histórico da locação */}
          {historicoLocacao && historicoLocacao.length > 0 && (
            <Cartao className="p-4">
              <h3 className="font-semibold text-sm mb-3">Histórico da locação</h3>
              <div className="flex flex-col gap-2">
                {historicoLocacao.map((h: any) => (
                  <Link key={h.id} href={`/cobrancas/${h.id}`} className="flex items-center justify-between py-1.5 hover:bg-papel rounded-lg px-2 -mx-2 transition">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={h.statusPagamento} />
                      <span className="text-xs text-suave">{fmtData(h.dataCobranca)}</span>
                    </div>
                    <span className="text-sm valor">{formatarBRL(h.valorLiquidoFinal)}</span>
                  </Link>
                ))}
              </div>
            </Cartao>
          )}

          {/* Manutenções */}
          {cobranca.manutencoes && cobranca.manutencoes.length > 0 && (
            <Cartao className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wrench size={16} className="text-latao" />
                <h3 className="font-semibold text-sm">Manutenções vinculadas</h3>
              </div>
              {cobranca.manutencoes.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-borda last:border-0">
                  <span className="text-sm">{m.tipo?.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-suave">{fmtData(m.data)}</span>
                </div>
              ))}
            </Cartao>
          )}
        </div>
      </div>
    </div>
  );
}
