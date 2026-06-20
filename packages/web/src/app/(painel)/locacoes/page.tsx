'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, FileSignature, ChevronDown, ChevronRight, Pencil, Search } from 'lucide-react';
import { useApi, revalidar } from '@/lib/swr';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarBRL, data as fmtData } from '@/lib/format';
import { Botao, Campo, Select, Cartao, Header, Badge, SkeletonCard, EmptyState, Modal, toast } from '@/components/ui/primitives';

const REGRA_LABEL: Record<string, string> = { VALOR_FIXO: 'Valor Fixo', PERCENTUAL_A_RECEBER: '% a Receber', PERCENTUAL_A_PAGAR: '% a Pagar' };
const STATUS_MAP: Record<string, { cor: 'verde' | 'azul' | 'cinza'; label: string }> = { ATIVA: { cor: 'verde', label: 'Ativa' }, FINALIZADA: { cor: 'cinza', label: 'Finalizada' } };

function normalizar(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw?.itens) return raw.itens;
  return [];
}

export default function LocacoesPage() {
  const { pode } = useAuth();
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [finalizando, setFinalizando] = useState<any | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const { data: clientes } = useApi<any[]>('/clientes');
  const { data: produtos } = useApi<any[]>('/produtos');
  const { data: depositos } = useApi<any[]>('/depositos');
  const { data: rawLocacoes, isLoading } = useApi<any>('/locacoes?limite=1000');
  const locacoes = normalizar(rawLocacoes);

  // Agrupa por cliente, aplicando busca (cliente ou plaqueta) e status.
  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtradas = locacoes.filter((l: any) => {
      if (statusFiltro && l.status !== statusFiltro) return false;
      if (!q) return true;
      return (l.cliente?.nome ?? '').toLowerCase().includes(q) || (l.produto?.plaqueta ?? '').toLowerCase().includes(q);
    });
    const mapa = new Map<string, { cliente: any; itens: any[]; saldo: number }>();
    for (const l of filtradas) {
      const cid = l.cliente?.id ?? 'sem';
      const g = mapa.get(cid) ?? { cliente: l.cliente ?? { id: cid, nome: '—' }, itens: [], saldo: 0 };
      g.itens.push(l);
      g.saldo += Number(l.saldoDevedorAtual ?? 0);
      mapa.set(cid, g);
    }
    return [...mapa.values()].sort((a, b) => (a.cliente?.nome ?? '').localeCompare(b.cliente?.nome ?? ''));
  }, [locacoes, busca, statusFiltro]);

  const buscando = busca.trim().length > 0;
  const isAberto = (id: string) => buscando || expandido[id];

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
      <Header titulo="Locações" subtitulo="Agrupadas por cliente"
        acoes={pode('locacoes.criar') ? <Botao tamanho="sm" icon={Plus} onClick={() => setCriando(true)}>Nova locação</Botao> : undefined}
      />

      {/* Busca + filtro */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente ou plaqueta..."
            className="w-full pl-9 pr-3 py-2 border border-borda rounded-xl text-sm bg-white focus:border-latao transition" />
        </div>
        <Select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className="sm:w-44">
          <option value="">Todos os status</option>
          <option value="ATIVA">Ativas</option>
          <option value="FINALIZADA">Finalizadas</option>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : grupos.length === 0 ? (
        <EmptyState icone={<FileSignature size={48} />} titulo="Nenhuma locação encontrada" descricao="Crie uma nova locação ou ajuste a busca." />
      ) : (
        <div className="flex flex-col gap-3">
          {grupos.map((g) => (
            <Cartao key={g.cliente.id} className="p-0 overflow-hidden">
              {/* Cabeçalho do cliente */}
              <button onClick={() => setExpandido((p) => ({ ...p, [g.cliente.id]: !p[g.cliente.id] }))}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-papel/60 transition text-left">
                <div className="flex items-center gap-2 min-w-0">
                  {isAberto(g.cliente.id) ? <ChevronDown size={16} className="text-suave flex-shrink-0" /> : <ChevronRight size={16} className="text-suave flex-shrink-0" />}
                  <span className="font-medium truncate">{g.cliente.nome}</span>
                  <Badge var="cinza">{g.itens.length}</Badge>
                </div>
                {g.saldo > 0 && <span className="text-xs text-amber-600 valor flex-shrink-0">Saldo {formatarBRL(g.saldo)}</span>}
              </button>

              {/* Locações do cliente */}
              {isAberto(g.cliente.id) && (
                <div className="border-t border-borda divide-y divide-borda">
                  {g.itens.map((l: any) => (
                    <div key={l.id} onClick={() => router.push(`/locacoes/${l.id}`)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-papel/40 transition cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium valor">{l.produto?.plaqueta ?? '—'}</span>
                          {l.produto?.descricao && <span className="text-xs text-suave truncate">{l.produto.descricao}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge var="azul">{REGRA_LABEL[l.regra] ?? l.regra}</Badge>
                          <span className="text-xs text-suave">{fmtData(l.dataInicio)}</span>
                          <Badge var={(STATUS_MAP[l.status]?.cor ?? 'cinza')}>{STATUS_MAP[l.status]?.label ?? l.status}</Badge>
                        </div>
                      </div>
                      <span className="text-sm valor flex-shrink-0">{formatarBRL(l.saldoDevedorAtual)}</span>
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {l.status === 'ATIVA' && pode('locacoes.editar') && (
                          <button onClick={() => { setEditando({ ...l }); setErro(''); }} title="Editar" className="p-1.5 text-suave hover:text-feltro transition"><Pencil size={15} /></button>
                        )}
                        {l.status === 'ATIVA' && pode('locacoes.finalizar_deposito') && (
                          <button onClick={() => setFinalizando({ id: l.id, tipo: 'DEPOSITO', produto: l.produto?.plaqueta ?? '—' })} className="text-xs text-suave hover:text-alerta transition px-1">Finalizar</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Cartao>
          ))}
        </div>
      )}

      {criando && <ModalNovaLocacao onClose={() => setCriando(false)} onSave={criarLocacao} clientes={clientes ?? []} produtos={produtos ?? []} salvando={salvando} erro={erro} />}
      {editando && <ModalEditarLocacao locacao={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); revalidar('/locacoes'); }} />}

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
              <RelocacaoCampos finalizando={finalizando} setFinalizando={setFinalizando} clientes={clientes ?? []} />
            )}
            {erro && <p className="text-alerta text-sm">{erro}</p>}
            <div className="flex gap-2 justify-end">
              <Botao variante="secundario" onClick={() => setFinalizando(null)}>Cancelar</Botao>
              <Botao variante="perigo" onClick={finalizarLocacao} loading={salvando}
                disabled={finalizando.tipo === 'DEPOSITO' ? !finalizando.depositoId : (!finalizando.novoClienteId || !finalizando.novoEnderecoId)}>
                Finalizar
              </Botao>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RelocacaoCampos({ finalizando, setFinalizando, clientes }: { finalizando: any; setFinalizando: (v: any) => void; clientes: any[] }) {
  const { data: enderecos } = useApi<any[]>(finalizando.novoClienteId ? `/enderecos?clienteId=${finalizando.novoClienteId}` : null);
  return (
    <>
      <Select label="Novo cliente" value={finalizando.novoClienteId ?? ''} onChange={(e) => setFinalizando({ ...finalizando, novoClienteId: e.target.value, novoEnderecoId: '' })}>
        <option value="">Selecione…</option>
        {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </Select>
      {finalizando.novoClienteId && (
        <Select label="Endereço do novo cliente" value={finalizando.novoEnderecoId ?? ''} onChange={(e) => setFinalizando({ ...finalizando, novoEnderecoId: e.target.value })}>
          <option value="">Selecione…</option>
          {(enderecos ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.logradouro}{e.numero ? `, ${e.numero}` : ''}</option>)}
        </Select>
      )}
    </>
  );
}

function ModalNovaLocacao({ onClose, onSave, clientes, produtos, salvando, erro }: { onClose: () => void; onSave: (d: any) => void; clientes: any[]; produtos: any[]; salvando: boolean; erro: string }) {
  const [dados, setDados] = useState<any>({ regra: 'VALOR_FIXO', frequencia: 'MENSAL' });
  const [clienteId, setClienteId] = useState('');
  const { data: enderecos } = useApi<any[]>(clienteId ? `/enderecos?clienteId=${clienteId}` : null);

  return (
    <Modal aberto={true} aoFechar={onClose} titulo="Nova locação" tamanho="lg">
      <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
        <Select label="Cliente" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setDados({ ...dados, enderecoId: '' }); }}>
          <option value="">Selecione…</option>
          {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        <Select label="Produto" value={dados.produtoId ?? ''} onChange={(e) => setDados({ ...dados, produtoId: e.target.value })}>
          <option value="">Selecione…</option>
          {produtos.map((p: any) => <option key={p.id} value={p.id}>{p.plaqueta} {p.descricao ?? ''}</option>)}
        </Select>
        {clienteId && (
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
        {erro && <p className="text-alerta text-sm">{erro}</p>}
        <div className="flex gap-2 justify-end mt-2">
          <Botao variante="secundario" onClick={onClose}>Cancelar</Botao>
          <Botao onClick={() => onSave({ ...dados, clienteId })} loading={salvando} disabled={!clienteId || !dados.produtoId || !dados.enderecoId}>Criar locação</Botao>
        </div>
      </div>
    </Modal>
  );
}

function ModalEditarLocacao({ locacao, onClose, onSaved }: { locacao: any; onClose: () => void; onSaved: () => void }) {
  const fixo = locacao.regra === 'VALOR_FIXO';
  const [frequencia, setFrequencia] = useState(locacao.frequencia ?? 'MENSAL');
  const [valorFixo, setValorFixo] = useState(locacao.valorFixo != null ? String(locacao.valorFixo) : '');
  const [valorPartida, setValorPartida] = useState(locacao.valorPartida != null ? String(locacao.valorPartida) : '');
  const [percentual, setPercentual] = useState(locacao.percentual != null ? String(locacao.percentual) : '');
  const [dataInicio, setDataInicio] = useState((locacao.dataInicio ?? '').slice(0, 10));
  const [enderecoId, setEnderecoId] = useState(locacao.enderecoId ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const { data: enderecos } = useApi<any[]>(locacao.cliente?.id ? `/enderecos?clienteId=${locacao.cliente.id}` : null);

  async function salvar() {
    setSalvando(true); setErro('');
    try {
      const body: any = { version: locacao.version };
      if (fixo) { body.frequencia = frequencia; if (valorFixo !== '') body.valorFixo = Number(valorFixo); }
      else { if (valorPartida !== '') body.valorPartida = Number(valorPartida); if (percentual !== '') body.percentual = Number(percentual); }
      if (dataInicio) body.dataInicio = new Date(dataInicio + 'T12:00:00').toISOString();
      if (enderecoId && enderecoId !== locacao.enderecoId) body.enderecoId = enderecoId;
      await api.patch(`/locacoes/${locacao.id}`, body);
      toast('Locação atualizada!', 'sucesso');
      onSaved();
    } catch (e: any) { setErro(e.message); toast(e.message, 'erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto={true} aoFechar={onClose} titulo={`Editar locação — ${locacao.produto?.plaqueta ?? ''}`}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-suave">Regra: <strong>{REGRA_LABEL[locacao.regra] ?? locacao.regra}</strong>. Alterar valores cria uma nova versão da regra; cobranças passadas não mudam.</p>
        {fixo ? (
          <>
            <Select label="Frequência" value={frequencia} onChange={(e) => setFrequencia(e.target.value)}>
              <option value="SEMANAL">Semanal</option>
              <option value="QUINZENAL">Quinzenal</option>
              <option value="MENSAL">Mensal</option>
            </Select>
            <Campo label="Valor fixo (R$)" inputMode="decimal" value={valorFixo} onChange={(e) => setValorFixo(e.target.value)} />
          </>
        ) : (
          <>
            <Campo label="Valor por partida (R$)" inputMode="decimal" value={valorPartida} onChange={(e) => setValorPartida(e.target.value)} />
            <Campo label="Percentual (%)" inputMode="decimal" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
          </>
        )}
        <Campo label="Data de início" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        <Select label="Endereço" value={enderecoId} onChange={(e) => setEnderecoId(e.target.value)}>
          <option value="">Selecione…</option>
          {(enderecos ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.logradouro}{e.numero ? `, ${e.numero}` : ''}</option>)}
        </Select>
        {erro && <p className="text-alerta text-sm">{erro}</p>}
        <div className="flex gap-2 justify-end mt-2">
          <Botao variante="secundario" onClick={onClose}>Cancelar</Botao>
          <Botao onClick={salvar} loading={salvando}>Salvar</Botao>
        </div>
      </div>
    </Modal>
  );
}
