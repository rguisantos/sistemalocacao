'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Botao, Campo, Dialogo, Tabela } from '@/components/ui/primitives';
import { MapaSeletor } from '@/components/MapaSeletor';
import { GerenciadorEnderecos } from '@/components/GerenciadorEnderecos';

interface Cliente { id: string; tipo: string; nome: string; cpfCnpj: string; rotaId: string; version: number; }
interface Rota { id: string; nome: string; }

export default function Clientes() {
  const { pode } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [editando, setEditando] = useState<any | null>(null);
  const [erro, setErro] = useState('');

  const carregar = () => { api.get('/clientes').then(setClientes); api.get('/rotas').then(setRotas).catch(() => setRotas([])); };
  useEffect(() => { carregar(); }, []);

  function novo() { setEditando({ tipo: 'PF', endereco: {} }); }

  async function salvar() {
    setErro('');
    try {
      if (editando.id) {
        await api.patch(`/clientes/${editando.id}`, { nome: editando.nome, rotaId: editando.rotaId, version: editando.version });
      } else {
        const e = editando.endereco ?? {};
        const endereco = e.logradouro
          ? { logradouro: e.logradouro, numero: e.numero, bairro: e.bairro, cidade: e.cidade, estado: e.estado, cep: e.cep, complemento: e.complemento, latitude: e.latitude, longitude: e.longitude }
          : undefined;
        await api.post('/clientes', { tipo: editando.tipo ?? 'PF', nome: editando.nome, cpfCnpj: editando.cpfCnpj, rotaId: editando.rotaId, endereco });
      }
      setEditando(null); carregar();
    } catch (e: any) { setErro(e.message); }
  }
  async function excluir(c: Cliente) { if (confirm(`Excluir ${c.nome}?`)) { await api.del(`/clientes/${c.id}`); carregar(); } }
  const nomeRota = (id: string) => rotas.find((r) => r.id === id)?.nome ?? '—';
  const setEnd = (campo: string, valor: any) => setEditando({ ...editando, endereco: { ...(editando.endereco ?? {}), [campo]: valor } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Clientes</h1>
        {pode('clientes.criar') && <Botao onClick={novo}><Plus size={16} className="inline mr-1" /> Novo cliente</Botao>}
      </div>

      <Tabela colunas={['Nome', 'CPF/CNPJ', 'Rota', '']}>
        {clientes.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-suave">Nenhum cliente ainda. Crie o primeiro para começar.</td></tr>}
        {clientes.map((c) => (
          <tr key={c.id}>
            <td className="px-4 py-3">{c.nome}</td>
            <td className="px-4 py-3 valor">{c.cpfCnpj}</td>
            <td className="px-4 py-3">{nomeRota(c.rotaId)}</td>
            <td className="px-4 py-3 text-right">
              <div className="flex gap-2 justify-end">
                {pode('clientes.editar') && <button onClick={() => setEditando({ ...c })} className="text-suave hover:text-feltro"><Pencil size={16} /></button>}
                {pode('clientes.excluir') && <button onClick={() => excluir(c)} className="text-suave hover:text-alerta"><Trash2 size={16} /></button>}
              </div>
            </td>
          </tr>
        ))}
      </Tabela>

      <Dialogo aberto={!!editando} aoFechar={() => setEditando(null)} titulo={editando?.id ? 'Editar cliente' : 'Novo cliente'}>
        {editando && (
          <div className="flex flex-col gap-3 max-h-[78vh] overflow-auto">
            <Campo label="Nome / Razão social" value={editando.nome ?? ''} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
            {!editando.id && (
              <Campo label="CPF / CNPJ (só dígitos)" value={editando.cpfCnpj ?? ''} onChange={(e) => setEditando({ ...editando, cpfCnpj: e.target.value })} />
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-suave font-medium">Rota</span>
              <select value={editando.rotaId ?? ''} onChange={(e) => setEditando({ ...editando, rotaId: e.target.value })} className="border border-borda rounded-xl px-3 py-2 bg-white">
                <option value="">Selecione…</option>
                {rotas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </label>

            {/* O endereço é cadastrado no cliente */}
            {editando.id ? (
              <div className="border-t border-borda pt-3">
                <GerenciadorEnderecos clienteId={editando.id} />
              </div>
            ) : (
              <div className="border-t border-borda pt-3 flex flex-col gap-3">
                <p className="text-suave font-medium text-sm">Endereço</p>
                <Campo label="Logradouro" value={editando.endereco?.logradouro ?? ''} onChange={(e) => setEnd('logradouro', e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Número" value={editando.endereco?.numero ?? ''} onChange={(e) => setEnd('numero', e.target.value)} />
                  <Campo label="Bairro" value={editando.endereco?.bairro ?? ''} onChange={(e) => setEnd('bairro', e.target.value)} />
                  <Campo label="Cidade" value={editando.endereco?.cidade ?? ''} onChange={(e) => setEnd('cidade', e.target.value)} />
                  <Campo label="UF" maxLength={2} value={editando.endereco?.estado ?? ''} onChange={(e) => setEnd('estado', e.target.value.toUpperCase())} />
                  <Campo label="CEP" value={editando.endereco?.cep ?? ''} onChange={(e) => setEnd('cep', e.target.value)} />
                  <Campo label="Complemento" value={editando.endereco?.complemento ?? ''} onChange={(e) => setEnd('complemento', e.target.value)} />
                </div>
                <MapaSeletor latitude={editando.endereco?.latitude} longitude={editando.endereco?.longitude} onChange={(lat, lng) => setEditando({ ...editando, endereco: { ...(editando.endereco ?? {}), latitude: lat, longitude: lng } })} />
              </div>
            )}

            {erro && <p className="text-alerta text-sm">{erro}</p>}
            <div className="flex gap-2 justify-end mt-1 sticky bottom-0 bg-white pt-2">
              <Botao variante="secundario" onClick={() => setEditando(null)}>Fechar</Botao>
              {(!editando.id || editando.nome) && <Botao onClick={salvar}>{editando.id ? 'Salvar cliente' : 'Criar cliente'}</Botao>}
            </div>
          </div>
        )}
      </Dialogo>
    </div>
  );
}
