'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Users, Search, Download, Eye } from 'lucide-react';
import { useApi, useApiMutation, revalidar } from '@/lib/swr';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { mascararCpfCnpj, mascararCep } from '@/lib/masks';
import { buscarCep } from '@/lib/cep';
import { Botao, Campo, Select, Modal, ConfirmModal, Tabela, Badge, SearchInput, Header, SkeletonTable, toast } from '@/components/ui/primitives';
import { MapaSeletor } from '@/components/MapaSeletor';
import { GerenciadorEnderecos } from '@/components/GerenciadorEnderecos';

interface Cliente { id: string; tipo: string; nome: string; cpfCnpj: string; rotaId: string; version: number; ativo?: boolean; }
interface Rota { id: string; nome: string; }

export default function Clientes() {
  const { pode } = useAuth();
  const [busca, setBusca] = useState('');
  const [filtroRota, setFiltroRota] = useState('');
  const [editando, setEditando] = useState<any | null>(null);
  const [excluindo, setExcluindo] = useState<Cliente | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluindoLoading, setExcluindoLoading] = useState(false);

  const { data: clientes, isLoading } = useApi<Cliente[]>('/clientes');
  const { data: rotas } = useApi<Rota[]>('/rotas');

  const { remover } = useApiMutation();

  // Filtro client-side (API não suporta busca ainda)
  const clientesFiltrados = (clientes ?? []).filter((c) => {
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase()) && !(c.cpfCnpj ?? '').includes(busca)) return false;
    if (filtroRota && c.rotaId !== filtroRota) return false;
    return true;
  });

  function novo() { setEditando({ tipo: 'PF' }); }

  async function salvar() {
    setErro(''); setSalvando(true);
    try {
      if (editando.id) {
        await api.patch(`/clientes/${editando.id}`, { nome: editando.nome, rotaId: editando.rotaId, version: editando.version });
        toast('Cliente atualizado!', 'sucesso');
      } else {
        const e = editando.endereco ?? {};
        const endereco = e.logradouro
          ? { logradouro: e.logradouro, numero: e.numero, bairro: e.bairro, cidade: e.cidade, estado: e.estado, cep: e.cep, complemento: e.complemento, latitude: e.latitude, longitude: e.longitude }
          : undefined;
        await api.post('/clientes', { tipo: editando.tipo ?? 'PF', nome: editando.nome, cpfCnpj: editando.cpfCnpj, rotaId: editando.rotaId, endereco });
        toast('Cliente criado!', 'sucesso');
      }
      setEditando(null); revalidar('/clientes');
    } catch (e: any) { setErro(e.message); toast(e.message, 'erro'); }
    finally { setSalvando(false); }
  }

  async function excluirCliente() {
    if (!excluindo) return;
    setExcluindoLoading(true);
    try {
      await remover(`/clientes/${excluindo.id}`);
      toast('Cliente excluído', 'sucesso');
      revalidar('/clientes');
    } catch (e: any) { toast(e.message, 'erro'); }
    finally { setExcluindoLoading(false); setExcluindo(null); }
  }

  const nomeRota = (id: string) => rotas?.find((r) => r.id === id)?.nome ?? '—';
  const setEnd = (campo: string, valor: any) => setEditando({ ...editando, endereco: { ...(editando.endereco ?? {}), [campo]: valor } });

  function exportarCSV() {
    if (!clientesFiltrados.length) return;
    const headers = ['Nome', 'CPF/CNPJ', 'Rota', 'Status'];
    const rows = clientesFiltrados.map((c) => [c.nome, c.cpfCnpj, nomeRota(c.rotaId), c.ativo !== false ? 'Ativo' : 'Inativo']);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click();
    URL.revokeObjectURL(url);
    toast('CSV exportado!', 'sucesso');
  }

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Clientes" subtitulo={`${clientesFiltrados.length} cliente${clientesFiltrados.length !== 1 ? 's' : ''}`}
        acoes={<div className="flex gap-2">
          {pode('clientes.criar') && <Botao onClick={novo} icon={Plus}>Novo cliente</Botao>}
          <Botao variante="secundario" tamanho="sm" icon={Download} onClick={exportarCSV}>CSV</Botao>
        </div>}
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput valor={busca} onChange={setBusca} placeholder="Buscar por nome ou CPF..." className="flex-1" />
        <Select value={filtroRota} onChange={(e) => setFiltroRota(e.target.value)} className="sm:w-48">
          <option value="">Todas as rotas</option>
          {rotas?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? <SkeletonTable /> : (
        <>
          {/* Desktop */}
          <div className="hidden lg:block">
            <Tabela colunas={['Nome', 'CPF/CNPJ', 'Rota', 'Status', '']} vazio="Nenhum cliente encontrado.">
              {clientesFiltrados.map((c) => (
                <tr key={c.id} className="hover:bg-papel/50 transition">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-feltro hover:text-latao transition">{c.nome}</Link>
                  </td>
                  <td className="px-4 py-3 valor">{mascararCpfCnpj(c.cpfCnpj || '')}</td>
                  <td className="px-4 py-3">{nomeRota(c.rotaId)}</td>
                  <td className="px-4 py-3"><Badge var={c.ativo !== false ? 'verde' : 'cinza'}>{c.ativo !== false ? 'Ativo' : 'Inativo'}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Link href={`/clientes/${c.id}`} className="text-suave hover:text-feltro transition p-1" title="Ver detalhes"><Eye size={16} /></Link>
                      {pode('clientes.editar') && <button onClick={() => setEditando({ ...c })} className="text-suave hover:text-feltro transition p-1"><Pencil size={16} /></button>}
                      {pode('clientes.excluir') && <button onClick={() => setExcluindo(c)} className="text-suave hover:text-alerta transition p-1"><Trash2 size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </Tabela>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden flex flex-col gap-3">
            {clientesFiltrados.length === 0 && (
              <div className="text-center text-suave py-12">Nenhum cliente encontrado.</div>
            )}
            {clientesFiltrados.map((c) => (
              <Link key={c.id} href={`/clientes/${c.id}`} className="bg-white border border-borda rounded-xl p-4 flex items-center justify-between hover:shadow-md transition block">
                <div>
                  <p className="font-medium">{c.nome}</p>
                  <p className="text-suave text-sm">{nomeRota(c.rotaId)} • {mascararCpfCnpj(c.cpfCnpj || '')}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge var={c.ativo !== false ? 'verde' : 'cinza'}>{c.ativo !== false ? 'Ativo' : 'Inativo'}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Modal de edição/criação */}
      <Modal aberto={!!editando} aoFechar={() => setEditando(null)} titulo={editando?.id ? 'Editar cliente' : 'Novo cliente'} tamanho="lg">
        {editando && (
          <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo label="Nome / Razão social" value={editando.nome ?? ''} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
              {!editando.id && (
                <Campo label="CPF / CNPJ" value={editando.cpfCnpj ?? ''} onChange={(e) => setEditando({ ...editando, cpfCnpj: desmascarar(e.target.value) })} />
              )}
            </div>
            <Select label="Rota" value={editando.rotaId ?? ''} onChange={(e) => setEditando({ ...editando, rotaId: e.target.value })}>
              <option value="">Selecione…</option>
              {rotas?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </Select>

            {editando.id ? (
              <div className="border-t border-borda pt-3">
                <GerenciadorEnderecos clienteId={editando.id} />
              </div>
            ) : (
              <div className="border-t border-borda pt-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-suave font-medium text-sm">Endereço principal</p>
                  {!editando.endereco?.logradouro && !editando.endereco?.cep && (
                    <Botao variante="fantasma" tamanho="sm" icon={Plus} onClick={() => setEditando({ ...editando, endereco: { ...(editando.endereco ?? {}) } })}>
                      Adicionar endereço
                    </Botao>
                  )}
                </div>
                {(editando.endereco?.logradouro !== undefined || editando.endereco?.cep !== undefined || Object.keys(editando.endereco ?? {}).length > 0) && (
                  <>
                    <div className="flex gap-2 items-end">
                      <Campo label="CEP" value={mascararCep(editando.endereco?.cep ?? '')} onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setEnd('cep', raw);
                        if (raw.length === 8) {
                          buscarCep(raw).then((result) => {
                            if (result) {
                              setEditando((prev: any) => ({
                                ...prev,
                                endereco: { ...(prev.endereco ?? {}), ...result },
                              }));
                              toast('Endereço preenchido automaticamente!', 'info');
                            }
                          });
                        }
                      }} className="sm:w-40" />
                      <Botao variante="fantasma" tamanho="sm" onClick={async () => {
                        const result = await buscarCep(editando.endereco?.cep ?? '');
                        if (result) {
                          setEditando((prev: any) => ({ ...prev, endereco: { ...(prev.endereco ?? {}), ...result } }));
                          toast('Endereço preenchido!', 'info');
                        } else { toast('CEP não encontrado', 'aviso'); }
                      }}>Buscar CEP</Botao>
                    </div>
                    <Campo label="Logradouro" value={editando.endereco?.logradouro ?? ''} onChange={(e) => setEnd('logradouro', e.target.value)} />
                    <div className="grid grid-cols-2 gap-3">
                      <Campo label="Número" value={editando.endereco?.numero ?? ''} onChange={(e) => setEnd('numero', e.target.value)} />
                      <Campo label="Bairro" value={editando.endereco?.bairro ?? ''} onChange={(e) => setEnd('bairro', e.target.value)} />
                      <Campo label="Cidade" value={editando.endereco?.cidade ?? ''} onChange={(e) => setEnd('cidade', e.target.value)} />
                      <Campo label="UF" maxLength={2} value={editando.endereco?.estado ?? ''} onChange={(e) => setEnd('estado', e.target.value.toUpperCase())} />
                    </div>
                    <Campo label="Complemento" value={editando.endereco?.complemento ?? ''} onChange={(e) => setEnd('complemento', e.target.value)} />
                    <MapaSeletor latitude={editando.endereco?.latitude} longitude={editando.endereco?.longitude} onChange={(lat, lng) => setEditando({ ...editando, endereco: { ...(editando.endereco ?? {}), latitude: lat, longitude: lng } })} />
                    <p className="text-xs text-suave">💡 Após criar o cliente, use &quot;Adicionar endereço&quot; na página de detalhe para cadastrar mais endereços.</p>
                  </>
                )}
              </div>
            )}

            {/* Observações */}
            <div className="border-t border-borda pt-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-suave font-medium">Observações</span>
                <textarea value={editando.observacoes ?? ''} onChange={(e) => setEditando({ ...editando, observacoes: e.target.value })}
                  className="border border-borda rounded-xl px-3 py-2 bg-white resize-y min-h-[60px] text-sm" placeholder="Observações sobre o cliente..." />
              </label>
            </div>

            {erro && <p className="text-alerta text-sm">{erro}</p>}
            <div className="flex gap-2 justify-end mt-2 pt-3 border-t border-borda">
              <Botao variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
              <Botao onClick={salvar} loading={salvando}>{editando.id ? 'Salvar' : 'Criar cliente'}</Botao>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal aberto={!!excluindo} aoFechar={() => setExcluindo(null)} onConfirm={excluirCliente}
        titulo="Excluir cliente" mensagem={`Tem certeza que deseja excluir o cliente "${excluindo?.nome}"? Esta ação não pode ser desfeita.`}
        loading={excluindoLoading} />
    </div>
  );
}

// Helper local
function desmascarar(v: string) { return v.replace(/\D/g, ''); }
