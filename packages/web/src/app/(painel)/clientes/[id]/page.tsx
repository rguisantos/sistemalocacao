'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Trash2, ArrowLeft, MapPin, Phone, FileText, DollarSign, ArrowRightLeft } from 'lucide-react';
import { useApi, useApiMutation, revalidar } from '@/lib/swr';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarBRL } from '@/lib/format';
import { mascararCpfCnpj, mascararTelefone } from '@/lib/masks';
import { data as fmtData } from '@/lib/format';
import { Cartao, Badge, Botao, Modal, ConfirmModal, Select, Tabela, Header, KpiCard, SkeletonCard, SkeletonTable, toast } from '@/components/ui/primitives';
import { StatusLocacaoBadge, StatusSaldoBadge, StatusPagamentoBadge } from '@/components/ui/primitives';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pode } = useAuth();

  const { data: c, isLoading, mutate } = useApi<any>(`/clientes/${id}`);
  const { data: rotas } = useApi<any[]>('/rotas');

  const [editandoRota, setEditandoRota] = useState(false);
  const [novaRotaId, setNovaRotaId] = useState('');
  const [transferindo, setTransferindo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [excluindoLoading, setExcluindoLoading] = useState(false);

  const { remover } = useApiMutation();

  if (isLoading || !c) {
    return (
      <div className="flex flex-col gap-6">
        <Header titulo="Cliente" acoes={<Link href="/clientes" className="text-sm text-suave hover:text-tinta transition">← Voltar</Link>} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        <SkeletonTable />
      </div>
    );
  }

  async function transferirRota() {
    if (!novaRotaId) return;
    setTransferindo(true);
    try {
      await api.patch(`/clientes/${id}/transferir-rota`, { rotaId: novaRotaId, version: c.version });
      toast('Rota transferida com sucesso!', 'sucesso');
      setEditandoRota(false);
      mutate();
      revalidar('/clientes');
    } catch (e: any) { toast(e.message, 'erro'); }
    finally { setTransferindo(false); }
  }

  async function excluirCliente() {
    setExcluindoLoading(true);
    try {
      await remover(`/clientes/${id}`);
      toast('Cliente excluído', 'sucesso');
      router.push('/clientes');
    } catch (e: any) { toast(e.message, 'erro'); }
    finally { setExcluindoLoading(false); setExcluindo(false as any); }
  }

  const telefones = Array.isArray(c.telefones) ? c.telefones : [];
  const rf = c.resumoFinanceiro ?? { locacoesAtivas: 0, saldoDevedorLocacoes: 0, saldoDevedorFinalizados: 0, totalSaldoDevedor: 0 };
  const statusMap: Record<string, 'verde' | 'amarelo' | 'azul'> = { PAGO: 'verde', PARCIAL: 'amarelo', PENDENTE: 'azul' };

  return (
    <div className="flex flex-col gap-6">
      <Header titulo={c.nome} subtitulo={mascararCpfCnpj(c.cpfCnpj || '')}
        acoes={
          <div className="flex gap-2">
            {pode('clientes.editar') && (
              <Link href={`/clientes/${id}/editar`}>
                <Botao variante="secundario" tamanho="sm" icon={Pencil}>Editar</Botao>
              </Link>
            )}
            {pode('clientes.excluir') && (
              <Botao variante="perigo" tamanho="sm" icon={Trash2} onClick={() => setExcluindo(true)}>Excluir</Botao>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Dados cadastrais */}
          <Cartao>
            <h2 className="font-display font-semibold mb-4">Dados cadastrais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-suave">Tipo</p>
                <p className="font-medium">{c.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}</p>
              </div>
              <div>
                <p className="text-suave">Rota</p>
                <div className="flex items-center gap-2">
                  <Badge var="azul">{c.rota?.nome ?? '—'}</Badge>
                  {pode('clientes.transferir_rota') && (
                    <button onClick={() => { setEditandoRota(true); setNovaRotaId(''); }} className="text-suave hover:text-latao transition p-1" title="Transferir rota">
                      <ArrowRightLeft size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-suave">Status</p>
                <Badge var={c.ativo !== false ? 'verde' : 'cinza'}>{c.ativo !== false ? 'Ativo' : 'Inativo'}</Badge>
              </div>
              {c.rgIe && <div><p className="text-suave">RG/IE</p><p className="font-medium">{c.rgIe}</p></div>}
            </div>

            {/* Telefones */}
            {telefones.length > 0 && (
              <div className="mt-4 pt-4 border-t border-borda">
                <p className="text-suave text-sm mb-2">Telefones</p>
                <div className="flex flex-wrap gap-2">
                  {telefones.map((t: any, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 text-sm"><Phone size={12} className="text-suave" />{mascararTelefone(t.numero || t.numeroTelefone || String(t))}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Observações */}
            {c.observacoes && (
              <div className="mt-4 pt-4 border-t border-borda">
                <p className="text-suave text-sm mb-1">Observações</p>
                <p className="text-sm">{c.observacoes}</p>
              </div>
            )}
          </Cartao>

          {/* Locações ativas */}
          <Cartao>
            <h2 className="font-display font-semibold mb-4">Locações ativas ({c.locacoes?.length ?? 0})</h2>
            {c.locacoes && c.locacoes.length > 0 ? (
              <Tabela colunas={['Produto', 'Regra', 'Endereço', 'Saldo devedor']}>
                {c.locacoes.map((l: any) => (
                  <tr key={l.id} className="hover:bg-papel/50 transition">
                    <td className="px-4 py-3 font-medium">{l.produto?.plaqueta} <span className="text-suave text-xs">{l.produto?.descricao}</span></td>
                    <td className="px-4 py-3"><Badge var="azul">{l.regra}</Badge></td>
                    <td className="px-4 py-3 text-suave text-xs">{l.endereco ? `${l.endereco.logradouro}, ${l.endereco.numero}` : '—'}</td>
                    <td className="px-4 py-3 valor">{formatarBRL(l.saldoDevedorAtual)}</td>
                  </tr>
                ))}
              </Tabela>
            ) : (
              <p className="text-suave text-sm text-center py-4">Nenhuma locação ativa.</p>
            )}
          </Cartao>

          {/* Cobranças recentes */}
          {c.cobrancasRecentes && c.cobrancasRecentes.length > 0 && (
            <Cartao>
              <h2 className="font-display font-semibold mb-4">Cobranças recentes</h2>
              <Tabela colunas={['Data', 'Produto', 'Valor', 'Status']}>
                {c.cobrancasRecentes.map((cr: any) => (
                  <tr key={cr.id} className="hover:bg-papel/50 transition">
                    <td className="px-4 py-3 text-xs">{fmtData(cr.data)}</td>
                    <td className="px-4 py-3">{cr.produto}</td>
                    <td className="px-4 py-3 valor">{formatarBRL(cr.valor)}</td>
                    <td className="px-4 py-3"><Badge var={statusMap[cr.status] || 'cinza'}>{cr.status}</Badge></td>
                  </tr>
                ))}
              </Tabela>
            </Cartao>
          )}

          {/* Saldo devedor de locações finalizadas */}
          {c.saldos && c.saldos.length > 0 && (
            <Cartao>
              <h2 className="font-display font-semibold mb-4">Saldos devedores (locações finalizadas)</h2>
              <Tabela colunas={['Produto', 'Valor original', 'Valor restante', 'Status']}>
                {c.saldos.map((s: any) => (
                  <tr key={s.id} className="hover:bg-papel/50 transition">
                    <td className="px-4 py-3">{s.produtoDescricao}</td>
                    <td className="px-4 py-3 valor">{formatarBRL(s.valorOriginal)}</td>
                    <td className="px-4 py-3 valor font-medium">{formatarBRL(s.valorRestante)}</td>
                    <td className="px-4 py-3"><StatusSaldoBadge status={s.status} /></td>
                  </tr>
                ))}
              </Tabela>
            </Cartao>
          )}
        </div>

        {/* Sidebar - Resumo financeiro */}
        <div className="flex flex-col gap-4">
          <Cartao>
            <h2 className="font-display font-semibold mb-4">Resumo financeiro</h2>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-suave">Locações ativas</span>
                <span className="font-medium">{rf.locacoesAtivas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-suave">Saldo locações ativas</span>
                <span className="valor font-medium">{formatarBRL(rf.saldoDevedorLocacoes)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-suave">Saldo finalizados</span>
                <span className="valor font-medium">{formatarBRL(rf.saldoDevedorFinalizados)}</span>
              </div>
              <div className="flex justify-between text-sm pt-3 border-t border-borda">
                <span className="font-medium">Total devido</span>
                <span className={`valor font-bold ${rf.totalSaldoDevedor > 0 ? 'text-alerta' : 'text-emerald-600'}`}>{formatarBRL(rf.totalSaldoDevedor)}</span>
              </div>
            </div>
          </Cartao>

          {/* Endereços */}
          {c.enderecos && c.enderecos.length > 0 && (
            <Cartao>
              <h2 className="font-display font-semibold mb-3">Endereços</h2>
              {c.enderecos.map((e: any, i: number) => (
                <div key={i} className={`flex items-start gap-2 text-sm ${i > 0 ? 'mt-3 pt-3 border-t border-borda' : ''}`}>
                  <MapPin size={14} className="text-suave mt-0.5 flex-shrink-0" />
                  <div>
                    <p>{e.logradouro}{e.numero ? `, ${e.numero}` : ''}</p>
                    {e.bairro && <p className="text-suave">{e.bairro}</p>}
                    <p className="text-suave text-xs">{e.cidade}{e.estado ? ` - ${e.estado}` : ''}{e.cep ? ` • ${e.cep}` : ''}</p>
                  </div>
                </div>
              ))}
            </Cartao>
          )}

          {/* Ações rápidas */}
          <Cartao>
            <h2 className="font-display font-semibold mb-3">Ações</h2>
            <div className="flex flex-col gap-2">
              {pode('locacoes.criar') && (
                <Link href="/cobrancas" className="text-sm text-feltro hover:text-feltro-claro transition flex items-center gap-2">
                  <FileText size={14} /> Registrar cobrança
                </Link>
              )}
              {pode('clientes.transferir_rota') && (
                <button onClick={() => { setEditandoRota(true); setNovaRotaId(''); }} className="text-sm text-feltro hover:text-feltro-claro transition flex items-center gap-2 text-left">
                  <ArrowRightLeft size={14} /> Transferir rota
                </button>
              )}
            </div>
          </Cartao>
        </div>
      </div>

      {/* Modal de transferência de rota */}
      <Modal aberto={editandoRota} aoFechar={() => setEditandoRota(false)} titulo="Transferir rota" tamanho="sm">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-suave">Mover <strong>{c.nome}</strong> da rota <strong>{c.rota?.nome}</strong> para:</p>
          <Select value={novaRotaId} onChange={(e) => setNovaRotaId(e.target.value)}>
            <option value="">Selecione a nova rota…</option>
            {(rotas ?? []).filter((r: any) => r.id !== c.rotaId).map((r: any) => (
              <option key={r.id} value={r.id}>{r.nome}</option>
            ))}
          </Select>
          <div className="flex gap-2 justify-end mt-2">
            <Botao variante="secundario" onClick={() => setEditandoRota(false)}>Cancelar</Botao>
            <Botao onClick={transferirRota} loading={transferindo} disabled={!novaRotaId}>Transferir</Botao>
          </div>
        </div>
      </Modal>

      {/* Confirmar exclusão */}
      <ConfirmModal aberto={excluindo} aoFechar={() => setExcluindo(false)} onConfirm={excluirCliente}
        titulo="Excluir cliente" mensagem={`Excluir "${c.nome}"? Esta ação não pode ser desfeita.`}
        loading={excluindoLoading} />
    </div>
  );
}
