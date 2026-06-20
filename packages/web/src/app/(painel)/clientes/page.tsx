'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Search, Download, Eye, X } from 'lucide-react';
import { useApi, useApiMutation, revalidar } from '@/lib/swr';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { mascararCpf, mascararCnpj, mascararCpfCnpj, mascararCep, mascararTelefone, desmascarar } from '@/lib/masks';
import { buscarCep } from '@/lib/cep';
import { Botao, Campo, Select, Modal, ConfirmModal, Tabela, Badge, SearchInput, Header, SkeletonTable, toast } from '@/components/ui/primitives';
import { MapaSeletor } from '@/components/MapaSeletor';
import { GerenciadorEnderecos } from '@/components/GerenciadorEnderecos';

interface Cliente {
  id: string; tipo: 'PF' | 'PJ'; nome: string; cpfCnpj: string; rgIe?: string;
  telefones?: string[]; observacoes?: string; rotaId: string; version: number;
}
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

  const clientesFiltrados = (clientes ?? []).filter((c) => {
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase()) && !(c.cpfCnpj ?? '').includes(desmascarar(busca))) return false;
    if (filtroRota && c.rotaId !== filtroRota) return false;
    return true;
  });

  function novo() { setEditando({ tipo: 'PF', telefones: [] }); setErro(''); }
  function editar(c: Cliente) { setEditando({ ...c, telefones: Array.isArray(c.telefones) ? c.telefones : [] }); setErro(''); }

  const tipoAtual: 'PF' | 'PJ' = editando?.tipo === 'PJ' ? 'PJ' : 'PF';
  const digitosDoc = desmascarar(editando?.cpfCnpj ?? '');
  const docOk = tipoAtual === 'PF' ? digitosDoc.length === 11 : digitosDoc.length === 14;

  async function salvar() {
    if (!editando) return;
    setErro('');
    // Validações de UX (a API revalida no servidor).
    if (!editando.nome || editando.nome.trim().length < 2) { setErro('Informe o nome / razão social.'); return; }
    if (!editando.rotaId) { setErro('Selecione a rota.'); return; }
    if (!editando.id && !docOk) { setErro(tipoAtual === 'PF' ? 'CPF deve ter 11 dígitos.' : 'CNPJ deve ter 14 dígitos.'); return; }

    const telefones = (editando.telefones ?? []).map((t: string) => t.trim()).filter(Boolean);
    setSalvando(true);
    try {
      if (editando.id) {
        await api.patch(`/clientes/${editando.id}`, {
          nome: editando.nome,
          rgIe: editando.rgIe || undefined,
          telefones,
          observacoes: editando.observacoes || undefined,
          rotaId: editando.rotaId,
          version: editando.version,
        });
        toast('Cliente atualizado!', 'sucesso');
      } else {
        const e = editando.endereco ?? {};
        const endereco = e.logradouro
          ? { logradouro: e.logradouro, numero: e.numero, bairro: e.bairro, cidade: e.cidade, estado: e.estado, cep: desmascarar(e.cep ?? '') || undefined, complemento: e.complemento, latitude: e.latitude, longitude: e.longitude }
          : undefined;
        await api.post('/clientes', {
          tipo: tipoAtual,
          nome: editando.nome,
          cpfCnpj: digitosDoc,
          rgIe: editando.rgIe || undefined,
          telefones,
          observacoes: editando.observacoes || undefined,
          rotaId: editando.rotaId,
          endereco,
        });
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
  const setEnd = (campo: string, valor: any) => setEditando((p: any) => ({ ...p, endereco: { ...(p.endereco ?? {}), [campo]: valor } }));

  // ── Telefones (lista dinâmica) ──
  const tels: string[] = editando?.telefones ?? [];
  const setTel = (i: number, v: string) => setEditando((p: any) => { const a = [...(p.telefones ?? [])]; a[i] = mascararTelefone(v); return { ...p, telefones: a }; });
  const addTel = () => setEditando((p: any) => ({ ...p, telefones: [...(p.telefones ?? []), ''] }));
  const rmTel = (i: number) => setEditando((p: any) => ({ ...p, telefones: (p.telefones ?? []).filter((_: any, j: number) => j !== i) }));

  function exportarCSV() {
    if (!clientesFiltrados.length) return;
    const headers = ['Tipo', 'Nome', 'CPF/CNPJ', 'RG/IE', 'Telefones', 'Rota'];
    const rows = clientesFiltrados.map((c) => [c.tipo, c.nome, mascararCpfCnpj(c.cpfCnpj || ''), c.rgIe ?? '', (c.telefones ?? []).join(' / '), nomeRota(c.rotaId)]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
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

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput valor={busca} onChange={setBusca} placeholder="Buscar por nome ou CPF/CNPJ..." className="flex-1" />
        <Select value={filtroRota} onChange={(e) => setFiltroRota(e.target.value)} className="sm:w-48">
          <option value="">Todas as rotas</option>
          {rotas?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </Select>
      </div>

      {isLoading ? <SkeletonTable /> : (
        <>
          <div className="hidden lg:block">
            <Tabela colunas={['Nome', 'Tipo', 'CPF/CNPJ', 'Telefone', 'Rota', '']} vazio="Nenhum cliente encontrado.">
              {clientesFiltrados.map((c) => (
                <tr key={c.id} className="hover:bg-papel/50 transition">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-feltro hover:text-latao transition">{c.nome}</Link>
                  </td>
                  <td className="px-4 py-3"><Badge var={c.tipo === 'PJ' ? 'roxo' : 'azul'}>{c.tipo === 'PJ' ? 'PJ' : 'PF'}</Badge></td>
                  <td className="px-4 py-3 valor">{mascararCpfCnpj(c.cpfCnpj || '')}</td>
                  <td className="px-4 py-3 text-sm text-suave">{(c.telefones ?? [])[0] ?? '—'}</td>
                  <td className="px-4 py-3">{nomeRota(c.rotaId)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Link href={`/clientes/${c.id}`} className="text-suave hover:text-feltro transition p-1" title="Ver detalhes"><Eye size={16} /></Link>
                      {pode('clientes.editar') && <button onClick={() => editar(c)} className="text-suave hover:text-feltro transition p-1"><Pencil size={16} /></button>}
                      {pode('clientes.excluir') && <button onClick={() => setExcluindo(c)} className="text-suave hover:text-alerta transition p-1"><Trash2 size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </Tabela>
          </div>

          <div className="lg:hidden flex flex-col gap-3">
            {clientesFiltrados.length === 0 && <div className="text-center text-suave py-12">Nenhum cliente encontrado.</div>}
            {clientesFiltrados.map((c) => (
              <Link key={c.id} href={`/clientes/${c.id}`} className="bg-white border border-borda rounded-xl p-4 flex items-center justify-between hover:shadow-md transition block">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.nome}</p>
                  <p className="text-suave text-sm truncate">{nomeRota(c.rotaId)} • {mascararCpfCnpj(c.cpfCnpj || '')}</p>
                </div>
                <Badge var={c.tipo === 'PJ' ? 'roxo' : 'azul'}>{c.tipo === 'PJ' ? 'PJ' : 'PF'}</Badge>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Modal de edição/criação */}
      <Modal aberto={!!editando} aoFechar={() => setEditando(null)} titulo={editando?.id ? 'Editar cliente' : 'Novo cliente'} tamanho="lg">
        {editando && (
          <div className="flex flex-col gap-4 max-h-[72vh] overflow-y-auto pr-1">
            {/* Tipo (PF/PJ) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-suave font-medium text-sm">Tipo de pessoa</span>
              <div className="inline-flex rounded-xl border border-borda overflow-hidden w-fit">
                {(['PF', 'PJ'] as const).map((t) => (
                  <button key={t} type="button"
                    onClick={() => !editando.id && setEditando({ ...editando, tipo: t })}
                    disabled={!!editando.id}
                    className={`px-4 py-2 text-sm transition ${tipoAtual === t ? 'bg-feltro text-papel' : 'bg-white text-suave hover:bg-papel'} ${editando.id ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                  </button>
                ))}
              </div>
              {editando.id && <span className="text-xs text-suave">Tipo e documento não podem ser alterados após o cadastro.</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo label={tipoAtual === 'PJ' ? 'Razão social' : 'Nome completo'} value={editando.nome ?? ''} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
              <Campo
                label={tipoAtual === 'PJ' ? 'CNPJ' : 'CPF'}
                value={tipoAtual === 'PJ' ? mascararCnpj(editando.cpfCnpj ?? '') : mascararCpf(editando.cpfCnpj ?? '')}
                onChange={(e) => setEditando({ ...editando, cpfCnpj: desmascarar(e.target.value) })}
                disabled={!!editando.id}
                erro={!editando.id && editando.cpfCnpj && !docOk ? (tipoAtual === 'PF' ? '11 dígitos' : '14 dígitos') : undefined}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo label={tipoAtual === 'PJ' ? 'Inscrição Estadual (IE)' : 'RG'} value={editando.rgIe ?? ''} onChange={(e) => setEditando({ ...editando, rgIe: e.target.value })} />
              <Select label="Rota" value={editando.rotaId ?? ''} onChange={(e) => setEditando({ ...editando, rotaId: e.target.value })}>
                <option value="">Selecione…</option>
                {rotas?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </Select>
            </div>

            {/* Telefones */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-suave font-medium text-sm">Telefones</span>
                <Botao variante="fantasma" tamanho="sm" icon={Plus} onClick={addTel}>Adicionar</Botao>
              </div>
              {tels.length === 0 && <p className="text-xs text-suave">Nenhum telefone. Clique em “Adicionar”.</p>}
              {tels.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={t} onChange={(e) => setTel(i, e.target.value)} inputMode="tel" placeholder="(00) 00000-0000"
                    className="flex-1 border border-borda rounded-xl px-3 py-2 bg-white text-sm focus:border-latao transition" />
                  <button type="button" onClick={() => rmTel(i)} className="p-2 text-suave hover:text-alerta transition" title="Remover"><X size={16} /></button>
                </div>
              ))}
            </div>

            {/* Endereço */}
            {editando.id ? (
              <div className="border-t border-borda pt-3">
                <GerenciadorEnderecos clienteId={editando.id} />
              </div>
            ) : (
              <div className="border-t border-borda pt-3 flex flex-col gap-3">
                <p className="text-suave font-medium text-sm">Endereço principal</p>
                <div className="flex gap-2 items-end">
                  <Campo label="CEP" value={mascararCep(editando.endereco?.cep ?? '')} onChange={(e) => {
                    const raw = desmascarar(e.target.value);
                    setEnd('cep', raw);
                    if (raw.length === 8) buscarCep(raw).then((result) => {
                      if (result) { setEditando((prev: any) => ({ ...prev, endereco: { ...(prev.endereco ?? {}), ...result } })); toast('Endereço preenchido automaticamente!', 'info'); }
                    });
                  }} className="sm:w-40" />
                  <Botao variante="fantasma" tamanho="sm" onClick={async () => {
                    const result = await buscarCep(desmascarar(editando.endereco?.cep ?? ''));
                    if (result) { setEditando((prev: any) => ({ ...prev, endereco: { ...(prev.endereco ?? {}), ...result } })); toast('Endereço preenchido!', 'info'); }
                    else toast('CEP não encontrado', 'aviso');
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
                <MapaSeletor latitude={editando.endereco?.latitude} longitude={editando.endereco?.longitude} onChange={(lat, lng) => setEditando((p: any) => ({ ...p, endereco: { ...(p.endereco ?? {}), latitude: lat, longitude: lng } }))} />
                <p className="text-xs text-suave">💡 Após criar o cliente, use “Adicionar endereço” na página de detalhe para cadastrar mais endereços.</p>
              </div>
            )}

            {/* Observações */}
            <label className="flex flex-col gap-1.5 text-sm border-t border-borda pt-3">
              <span className="text-suave font-medium">Observações</span>
              <textarea value={editando.observacoes ?? ''} onChange={(e) => setEditando({ ...editando, observacoes: e.target.value })}
                className="border border-borda rounded-xl px-3 py-2 bg-white resize-y min-h-[60px] text-sm" placeholder="Observações sobre o cliente..." />
            </label>

            {erro && <p className="text-alerta text-sm">{erro}</p>}
            <div className="flex gap-2 justify-end pt-3 border-t border-borda">
              <Botao variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
              <Botao onClick={salvar} loading={salvando}>{editando.id ? 'Salvar' : 'Criar cliente'}</Botao>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal aberto={!!excluindo} aoFechar={() => setExcluindo(null)} onConfirm={excluirCliente}
        titulo="Excluir cliente" mensagem={`Tem certeza que deseja excluir o cliente "${excluindo?.nome}"? Esta ação não pode ser desfeita.`}
        loading={excluindoLoading} />
    </div>
  );
}
