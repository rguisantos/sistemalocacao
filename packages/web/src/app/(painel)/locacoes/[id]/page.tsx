'use client';
import { useApi } from '@/lib/swr';
import { formatarBRL, data as fmtData } from '@/lib/format';
import { Cartao, Badge, Botao, Header, SkeletonCard, EmptyState, Tabela } from '@/components/ui/primitives';
import { ArrowLeft, MapPin, Clock, CheckCircle2, AlertCircle, Receipt, Wrench } from 'lucide-react';
import Link from 'next/link';

const REGRA_LABEL: Record<string, string> = {
  VALOR_FIXO: 'Valor Fixo',
  PERCENTUAL_A_RECEBER: '% a Receber',
  PERCENTUAL_A_PAGAR: '% a Pagar',
};
const STATUS_PAG_MAP: Record<string, { cor: string; label: string }> = {
  PENDENTE: { cor: 'bg-amber-100 text-amber-800', label: 'Pendente' },
  PARCIAL: { cor: 'bg-blue-100 text-blue-800', label: 'Parcial' },
  PAGO: { cor: 'bg-emerald-100 text-emerald-800', label: 'Pago' },
};

export default function LocacaoDetalhePage({ params }: { params: { id: string } }) {
  const { data: l, isLoading, error } = useApi<any>(`/locacoes/${params.id}`);

  if (isLoading) return <div className="flex flex-col gap-6"><SkeletonCard /><SkeletonCard /></div>;
  if (error || !l) return <EmptyState icone={<Receipt size={48} />} titulo="Locação não encontrada" />;

  const isAtiva = l.status === 'ATIVA';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <Link href="/locacoes"><Botao variante="fantasma" tamanho="sm" icon={ArrowLeft}>Voltar</Botao></Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">Locação {l.produto?.plaqueta}</h1>
          <p className="text-suave text-sm mt-1">{l.cliente?.nome} • {fmtData(l.dataInicio)}{l.dataFim ? ` — ${fmtData(l.dataFim)}` : ''}</p>
        </div>
        <Badge var={isAtiva ? 'verde' : 'cinza'}>{isAtiva ? 'Ativa' : 'Finalizada'}</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Cartao className="p-4">
          <p className="text-xs text-suave uppercase tracking-wide mb-1">Regra</p>
          <p className="font-semibold">{REGRA_LABEL[l.regra] ?? l.regra}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-suave uppercase tracking-wide mb-1">Saldo devedor</p>
          <p className={`valor text-xl font-bold ${Number(l.saldoDevedorAtual) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatarBRL(l.saldoDevedorAtual)}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-suave uppercase tracking-wide mb-1">Cobranças</p>
          <p className="text-xl font-bold">{l.cobrancas?.length ?? 0}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs text-suave uppercase tracking-wide mb-1">Versão regra</p>
          <p className="text-xl font-bold">v{l.regraVersao ?? 1}</p>
        </Cartao>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coluna 1: Informações */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Cartao className="p-4">
            <h3 className="font-semibold text-sm mb-3">Produto</h3>
            <p className="font-medium">{l.produto?.plaqueta}</p>
            {l.produto?.descricao && <p className="text-xs text-suave">{l.produto.descricao}</p>}
            {l.produto?.contador != null && <p className="text-xs text-suave mt-1">Contador: {l.produto.contador}</p>}
          </Cartao>

          <Cartao className="p-4">
            <h3 className="font-semibold text-sm mb-3">Cliente</h3>
            <Link href={`/clientes/${l.cliente?.id}`} className="text-feltro hover:text-latao font-medium transition">{l.cliente?.nome}</Link>
          </Cartao>

          {l.endereco && (
            <Cartao className="p-4">
              <div className="flex items-center gap-2 mb-2"><MapPin size={14} className="text-latao" /><h3 className="font-semibold text-sm">Endereço</h3></div>
              <p className="text-sm">{l.endereco.logradouro}{l.endereco.numero ? `, ${l.endereco.numero}` : ''}</p>
              <p className="text-xs text-suave">{l.endereco.bairro} • {l.endereco.cidade}{l.endereco.estado ? ` - ${l.endereco.estado}` : ''}</p>
            </Cartao>
          )}

          {/* Parâmetros da regra */}
          <Cartao className="p-4">
            <h3 className="font-semibold text-sm mb-3">Parâmetros da regra</h3>
            {l.regra === 'VALOR_FIXO' ? (
              <>
                <div className="flex justify-between text-sm"><span className="text-suave">Frequência</span><span>{l.frequencia ?? '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-suave">Valor fixo</span><span className="valor">{formatarBRL(l.valorFixo)}</span></div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm"><span className="text-suave">Valor/partida</span><span className="valor">{formatarBRL(l.valorPartida)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-suave">Percentual</span><span>{l.percentual}%</span></div>
                <div className="flex justify-between text-sm"><span className="text-suave">Contador inicial</span><span>{l.contadorInicial}</span></div>
              </>
            )}
          </Cartao>

          {l.finalizacaoTipo && (
            <Cartao className="p-4 border-amber-200 bg-amber-50">
              <h3 className="font-semibold text-sm text-amber-800">Finalização</h3>
              <p className="text-sm text-amber-700">Tipo: {l.finalizacaoTipo}{l.deposito?.nome ? ` — ${l.deposito.nome}` : ''}</p>
              {l.dataFim && <p className="text-xs text-amber-600">Data: {fmtData(l.dataFim)}</p>}
            </Cartao>
          )}
        </div>

        {/* Coluna 2-3: Cobranças */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Cartao className="p-4">
            <h3 className="font-semibold mb-4">Cobranças recentes ({l.cobrancas?.length ?? 0})</h3>
            {(!l.cobrancas || l.cobrancas.length === 0) ? (
              <p className="text-sm text-suave text-center py-4">Nenhuma cobrança registrada.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {l.cobrancas.map((c: any) => {
                  const totalPago = c.pagamentos?.reduce((s: number, p: any) => s + Number(p.valor), 0) ?? 0;
                  const st = STATUS_PAG_MAP[c.statusPagamento] ?? STATUS_PAG_MAP.PENDENTE;
                  return (
                    <Link key={c.id} href={`/cobrancas/${c.id}`} className="block border border-borda rounded-xl p-3 hover:bg-papel/50 transition">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{fmtData(c.dataCobranca)}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.cor}`}>{st.label}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-suave">Líquido: <span className="valor font-medium text-tinta">{formatarBRL(c.valorLiquidoFinal)}</span></span>
                        {totalPago > 0 && <span className="text-emerald-600">Pago: {formatarBRL(totalPago)}</span>}
                      </div>
                      {c.trocaPano && <p className="text-xs text-amber-600 mt-1">⚠ Troca de pano</p>}
                      {c.pagamentos?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-borda">
                          {c.pagamentos.slice(0, 3).map((p: any) => (
                            <div key={p.id} className="flex justify-between text-xs text-suave">
                              <span>{formatarBRL(p.valor)} • {p.formaPagamento?.replace(/_/g, ' ')}</span>
                              <span>{fmtData(p.dataPagamento)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </Cartao>

          {/* Saldos devedores (locações finalizadas) */}
          {l.saldos && l.saldos.length > 0 && (
            <Cartao className="p-4">
              <h3 className="font-semibold mb-3">Saldos devedores</h3>
              {l.saldos.map((s: any) => (
                <div key={s.id} className="flex justify-between text-sm py-2 border-b border-borda last:border-0">
                  <span>Original: {formatarBRL(s.valorOriginal)}</span>
                  <span className="valor font-medium">Restante: {formatarBRL(s.valorRestante)}</span>
                </div>
              ))}
            </Cartao>
          )}
        </div>
      </div>
    </div>
  );
}
