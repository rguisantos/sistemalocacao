'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Filter, FileSignature, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useApi, useApiPaginated, useApiMutation, revalidar } from '@/lib/swr';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarBRL, data as fmtData } from '@/lib/format';
import {
  Botao, Campo, Select, Cartao, Header, Badge, Tabela,
  Paginacao, SkeletonCard, EmptyState, Modal, toast,
} from '@/components/ui/primitives';

const REGRA_LABEL: Record<string, string> = {
  VALOR_FIXO: 'Valor Fixo',
  PERCENTUAL_A_RECEBER: '% a Receber',
  PERCENTUAL_A_PAGAR: '% a Pagar',
};
const STATUS_MAP: Record<string, { cor: 'verde' | 'azul' | 'cinza'; label: string }> = {
  ATIVA: { cor: 'verde', label: 'Ativa' },
  FINALIZADA: { cor: 'cinza', label: 'Finalizada' },
};

export default function LocacoesPage() {
  const { pode } = useAuth();
  const [clienteId, setClienteId] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [pagina, setPagina] = useState(1);

  // Modal nova locação
  const [criando, setCriando] = useState(false);
  const [finalizando, setFinalizando] = useState<any | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const { data: clientes } = useApi<any[]>('/clientes');
  const { data: produtos } = useApi<any[]>('/produtos');
  const { data: depositos } = useApi<any[]>('/depositos');

  // Endereços do cliente selecionado (para criar locação)
  const [novoClienteId, setNovoClienteId] = useState('');
  const { data: enderecos } = useApi<any[]>(novoClienteId ? `/enderecos?clienteId=${novoClienteId}` : null);

  const params = new URLSearchParams();
  if (clienteId) params.set('clienteId', clienteId);
  if (statusFiltro) params.set('status', statusFiltro);
  params.set('pagina', String(pagina));
  params.set('limite', '15');

  const { data: resultado, isLoading } = useApiPaginated<any>(`/locacoes?${params.toString()}`, pagina, 15);
  const locacoes = resultado?.itens ?? [];
  const total = resultado?.total ?? 0;

  async function criarLocacao(dados: any) {
    setSalvando(true); setErro('');
    try {
      const base: any = { produtoId: dados.produtoId, clienteId: dados.clienteId, enderecoId: dados.enderecoId, regra: dados.regra };
      if (dados.regra === 'VALOR_FIXO') { base.frequencia = dados.frequencia ?? 'MENSAL'; base.valorFixo = Number(dados.valorFixo); }
      else { base.valorPartida = Number(dados.valorPartida); base.percentual = Number(dados.percentual); }
      if (dados.contadorInicial) base.contadorInicial = Number(dados.contadorInicial);
      await api.post('/locacoes', base);
      revalidar('/locacoes');
      toast('Locação criada!', 'sucesso');
      setCriando(false);
    } catch (e: any) { setErro(e.message); toast(e.message, 'erro'); }
    finally { setSalvando(false); }
  }

  async function finalizarLocacao() {
    if (!finalizando) return;
    setSalvando(true); setErro('');
    try {
      const corpo: any = { tipo: finalizando.tipo };
      if (finalizando.tipo === 'DEPOSITO') corpo.depositoId = finalizando.depositoId;
      else corpo.novaLocacao = { clienteId: finalizando.novoClienteId, enderecoId: finalizando.novoEnderecoId };
      await api.post(`/locacoes/${finalizando.id}/finalizar`, corpo);
      revalidar('/locacoes');
      toast('Locação finalizada!', 'sucesso');
      setFinalizando(null);
    } catch (e: any) { setErro(e.message); toast(e.message, 'erro'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Locações" subtitulo="Gerencie locações de produtos"
        acoes={pode('locacoes.criar') ? <Botao tamanho="sm" icon={Plus} onClick={() => { setCriando(true); setNovoClienteId(''); }}>Nova locação</Botao> : undefined}
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setPagina(1); }} className="sm:w-48">
          <option value="">Todos os clientes</option>
          {(clientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        <Botao variante="secundario" tamanho="sm" icon={mostrarFiltros ? ChevronUp : ChevronDown} onClick={() => setMostrarFiltros(!mostrarFiltros)}>
          Filtros
        </Botao>
      </div>
      {mostrarFiltros && (
        <Cartao className="flex flex-wrap items-end gap-4">
          <Select label="Status" value={statusFiltro} onChange={(e) => { setStatusFiltro(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>
            <option value="ATIVA">Ativa</option>
            <option value="FINALIZADA">Finalizada</option>
          </Select>
          <Botao variante="fantasma" tamanho="sm" onClick={() => { setClienteId(''); setStatusFiltro(''); setPagina(1); }}>Limpar</Botao>
        </Cartao>
      )}

      {/* Tabela */}
      {isLoading ? (
        <div className="grid gap-4">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : locacoes.length === 0 ? (
        <EmptyState icone={<FileSignature size={48} />} titulo="Nenhuma locação encontrada" descricao="Crie uma nova locação ou ajuste os filtros." />
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <Tabela colunas={['Produto', 'Cliente', 'Regra', 'Início', 'Saldo', 'Status', '']}>
              {locacoes.map((l: any) => (
                <tr key={l.id} className="hover:bg-papel/50 transition">
                  <td className="px-4 py-3 text-sm font-medium">{l.produto?.plaqueta} <span className="text-suave text-xs">{l.produto?.descricao}</span></td>
                  <td className="px-4 py-3 text-sm">{l.cliente?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-sm"><Badge var="azul">{REGRA_LABEL[l.regra] ?? l.regra}</Badge></td>
                  <td className="px-4 py-3 text-sm text-suave">{fmtData(l.dataInicio)}</td>
                  <td className="px-4 py-3 text-sm valor">{formatarBRL(l.saldoDevedorAtual)}</td>
                  <td className="px-4 py-3"><Badge var={(STATUS_MAP[l.status]?.cor ?? 'cinza') as any}>{STATUS_MAP[l.status]?.label ?? l.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Link href={`/locacoes/${l.id}`} className="text-feltro hover:text-latao text-sm transition">Detalhes</Link>
                      {l.status === 'ATIVA' && pode('locacoes.finalizar_deposito') && (
                        <button onClick={() => setFinalizando({ id: l.id, tipo: 'DEPOSITO', produto: l.produto?.plaqueta })} className="text-suave hover:text-alerta text-sm transition ml-2">Finalizar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Tabela>
          </div>

          <div className="md:hidden flex flex-col gap-3">
            {locacoes.map((l: any) => (
              <Cartao key={l.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{l.produto?.plaqueta}</span>
                  <Badge var={(STATUS_MAP[l.status]?.cor ?? 'cinza') as any}>{STATUS_MAP[l.status]?.label ?? l.status}</Badge>
                </div>
                <p className="text-xs text-suave">{l.cliente?.nome} • {REGRA_LABEL[l.regra] ?? l.regra}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-suave">Saldo: <span className="valor font-medium">{formatarBRL(l.saldoDevedorAtual)}</span></span>
                  <Link href={`/locacoes/${l.id}`} className="text-feltro text-sm">Ver</Link>
                </div>
              </Cartao>
            ))}
          </div>

          <Paginacao pagina={pagina} total={total} limite={15} onChange={setPagina} />
        </>
      )}

      {/* Modal nova locação */}
      {criando && <ModalNovaLocacao onClose={() => setCriando(false)} onSave={criarLocacao} clientes={clientes ?? []} produtos={produtos ?? []} />}

      {/* Modal finalizar */}
      {finalizando && (
        <Modal aberto={true} aoFechar={() => setFinalizando(null)} titulo="Finalizar locação">
          <div className="flex flex-col gap-3">
            <p className="text-sm">Finalizar locação do produto <strong>{finalizando.produto}</strong></p>
            <Select label="Destino" value={finalizando.tipo} onChange={(e) => setFinalizando({ ...finalizando, tipo: e.target.value })}>
              <option value="DEPOSITO">Depósito</option>
              <option value="RELOCACAO">Relocação</option>
            </Select>
            {finalizando.tipo === 'DEPOSITO' ? (
              <Select label="Depósito" value={finalizando.depositoId ?? ''} onChange={(e) => setFinalizando({ ...finalizando, depositoId: e.target.value })}>
                <option value="">Selecione…</option>
                {(depositos ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </Select>
            ) : (
              <>
                <Select label="Novo cliente" value={finalizando.novoClienteId ?? ''} onChange={(e) => setFinalizando({ ...finalizando, novoClienteId: e.target.value, novoEnderecoId: '' })}>
                  <option value="">Selecione…</option>
                  {(clientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </>
            )}
            {erro && <p className="text-alerta text-sm">{erro}</p>}
            <div className="flex gap-2 justify-end">
              <Botao variante="secundario" onClick={() => setFinalizando(null)}>Cancelar</Botao>
              <Botao variante="perigo" onClick={finalizarLocacao} loading={salvando}>Finalizar</Botao>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── Modal Nova Locação ─── */
function ModalNovaLocacao({ onClose, onSave, clientes, produtos }: { onClose: () => void; onSave: (dados: any) => void; clientes: any[]; produtos: any[] }) {
  const [dados, setDados] = useState<any>({ regra: 'VALOR_FIXO', frequencia: 'MENSAL' });
  const [novoClienteId, setNovoClienteId] = useState('');
  const { data: enderecos } = useApi<any[]>(novoClienteId ? `/enderecos?clienteId=${novoClienteId}` : null);

  return (
    <Modal aberto={true} aoFechar={onClose} titulo="Nova locação" tamanho="lg">
      <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
        <Select label="Cliente" value={novoClienteId} onChange={(e) => { setNovoClienteId(e.target.value); setDados({ ...dados, clienteId: e.target.value, enderecoId: '' }); }}>
          <option value="">Selecione…</option>
          {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        <Select label="Produto" value={dados.produtoId ?? ''} onChange={(e) => setDados({ ...dados, produtoId: e.target.value })}>
          <option value="">Selecione…</option>
          {produtos.map((p: any) => <option key={p.id} value={p.id}>{p.plaqueta} {p.descricao ?? ''}</option>)}
        </Select>
        {novoClienteId && (
          <Select label="Endereço" value={dados.enderecoId ?? ''} onChange={(e) => setDados({ ...dados, enderecoId: e.target.value })}>
            <option value="">Selecione…</option>
            {(enderecos ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.logradouro}{e.numero ? `, ${e.numero}` : ''}</option>)}
          </Select>
        )}
        <Select label="Regra" value={dados.regra} onChange={(e) => setDados({ ...dados, regra: e.target.value })}>
          <option value="VALOR_FIXO">Valor fixo</option>
          <option value="PERCENTUAL_A_RECEBER">Percentual a receber</option>
          <option value="PERCENTUAL_A_PAGAR">Percentual a pagar</option>
        </Select>
        {dados.regra === 'VALOR_FIXO' ? (
          <>
            <Select label="Frequência" value={dados.frequencia ?? 'MENSAL'} onChange={(e) => setDados({ ...dados, frequencia: e.target.value })}>
              <option value="SEMANAL">Semanal</option>
              <option value="QUINZENAL">Quinzenal</option>
              <option value="MENSAL">Mensal</option>
            </Select>
            <Campo label="Valor fixo (R$)" inputMode="decimal" value={dados.valorFixo ?? ''} onChange={(e) => setDados({ ...dados, valorFixo: e.target.value })} />
          </>
        ) : (
          <>
            <Campo label="Valor por partida (R$)" inputMode="decimal" value={dados.valorPartida ?? ''} onChange={(e) => setDados({ ...dados, valorPartida: e.target.value })} />
            <Campo label="Percentual (%)" inputMode="decimal" value={dados.percentual ?? ''} onChange={(e) => setDados({ ...dados, percentual: e.target.value })} />
            <Campo label="Contador inicial" inputMode="numeric" value={dados.contadorInicial ?? ''} onChange={(e) => setDados({ ...dados, contadorInicial: e.target.value })} />
          </>
        )}
        <div className="flex gap-2 justify-end mt-2">
          <Botao variante="secundario" onClick={onClose}>Cancelar</Botao>
          <Botao onClick={() => onSave({ ...dados, clienteId: novoClienteId })} disabled={!novoClienteId || !dados.produtoId || !dados.enderecoId}>Criar locação</Botao>
        </div>
      </div>
    </Modal>
  );
}
