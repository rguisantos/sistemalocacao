'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatarBRL } from '@locacoes/shared';

interface Cliente {
  id: string; nome: string; cpfCnpj: string | null; tipo: string;
  telefones: { numero: string; tipo: string }[];
  rota: { id: string; nome: string };
  enderecos: { id: string; logradouro: string; numero: string; bairro: string }[];
  _count: { locacoes: number };
}
interface Rota { id: string; nome: string }

export default function ClientesPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState({ nome: '', cpfCnpj: '', rotaId: '', telefone: '' });
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [formEdit, setFormEdit] = useState({ nome: '', telefone: '', rotaId: '' });

  const editar = useMutation({
    mutationFn: () => api(`/api/clientes/${editando!.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        nome: formEdit.nome,
        rotaId: formEdit.rotaId,
        telefones: formEdit.telefone ? [{ numero: formEdit.telefone, tipo: 'celular' }] : [],
      }),
    }),
    onSuccess: () => { setEditando(null); qc.invalidateQueries({ queryKey: ['clientes'] }); },
    onError: (e: Error) => setErro(e.message),
  });

  function abrirEdicao(c: Cliente, e: React.MouseEvent) {
    e.stopPropagation();
    setErro('');
    setEditando(c);
    setFormEdit({
      nome: c.nome,
      telefone: c.telefones?.[0]?.numero ?? '',
      rotaId: c.rota?.id ?? '',
    });
  }

  const { data: clientes } = useQuery({
    queryKey: ['clientes', busca],
    queryFn: () => api<Cliente[]>(`/api/clientes${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`),
  });
  const { data: rotas } = useQuery({ queryKey: ['rotas'], queryFn: () => api<Rota[]>('/api/rotas') });

  const criar = useMutation({
    mutationFn: () => api('/api/clientes', {
      method: 'POST',
      body: JSON.stringify({
        nome: form.nome, cpfCnpj: form.cpfCnpj || null, rotaId: form.rotaId,
        telefones: form.telefone ? [{ numero: form.telefone, tipo: 'celular' }] : [],
      }),
    }),
    onSuccess: () => { setNovo(false); setForm({ nome: '', cpfCnpj: '', rotaId: '', telefone: '' }); qc.invalidateQueries({ queryKey: ['clientes'] }); },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-feltro">Clientes</h1>
        <button onClick={() => setNovo(!novo)} className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white">
          {novo ? 'Cancelar' : '+ Novo cliente'}
        </button>
      </div>

      {novo && (
        <div className="mb-6 grid gap-3 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-2">
          <input className="rounded-lg border px-3 py-2" placeholder="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className="rounded-lg border px-3 py-2" placeholder="CPF/CNPJ" value={form.cpfCnpj} onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })} />
          <input className="rounded-lg border px-3 py-2" placeholder="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          <select className="rounded-lg border px-3 py-2" value={form.rotaId} onChange={(e) => setForm({ ...form, rotaId: e.target.value })}>
            <option value="">Rota *</option>
            {rotas?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
          <button onClick={() => criar.mutate()} disabled={!form.nome || !form.rotaId || criar.isPending}
            className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">
            Salvar cliente
          </button>
        </div>
      )}

      {editando && (
        <div className="mb-6 grid gap-3 rounded-xl border-2 border-feltro/30 bg-white p-5 shadow-sm sm:grid-cols-4">
          <p className="text-sm font-semibold text-feltro sm:col-span-4">Editando: {editando.nome}</p>
          <input className="rounded-lg border px-3 py-2" placeholder="Nome" value={formEdit.nome}
            onChange={(e) => setFormEdit({ ...formEdit, nome: e.target.value })} />
          <input className="rounded-lg border px-3 py-2" placeholder="Telefone" value={formEdit.telefone}
            onChange={(e) => setFormEdit({ ...formEdit, telefone: e.target.value })} />
          <select className="rounded-lg border px-3 py-2" value={formEdit.rotaId}
            onChange={(e) => setFormEdit({ ...formEdit, rotaId: e.target.value })}>
            {rotas?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => editar.mutate()} disabled={editar.isPending}
              className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Salvar
            </button>
            <button onClick={() => setEditando(null)} className="rounded-lg border px-4 py-2 text-sm text-stone-500">
              Cancelar
            </button>
          </div>
          {erro && <p className="text-sm text-red-600 sm:col-span-4">{erro}</p>}
        </div>
      )}

      <input className="mb-4 w-full rounded-lg border px-3 py-2" placeholder="Buscar por nome ou CPF/CNPJ…" value={busca} onChange={(e) => setBusca(e.target.value)} />

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-stone-50 text-left text-xs uppercase text-stone-400">
            <th className="p-3">Nome</th><th>Rota</th><th>Endereços</th><th>Locações ativas</th><th></th>
          </tr></thead>
          <tbody>
            {clientes?.map((c) => (
              <tr key={c.id} className="cursor-pointer border-b last:border-0 hover:bg-stone-50"
                onClick={() => router.push(`/painel/clientes/${c.id}`)}>
                <td className="p-3 font-medium">{c.nome}<br /><span className="text-xs text-stone-400">{c.cpfCnpj ?? ''}</span></td>
                <td>{c.rota?.nome}</td>
                <td className="text-xs text-stone-500">{c.enderecos.map((e) => `${e.logradouro}, ${e.numero}`).join(' · ') || '—'}</td>
                <td>{c._count.locacoes}</td>
                <td className="pr-3 text-right">
                  <button onClick={(e) => abrirEdicao(c, e)}
                    className="text-xs text-stone-400 hover:text-feltro">editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(clientes?.length ?? 0) === 0 && <p className="p-6 text-center text-stone-400">Nenhum cliente encontrado.</p>}
      </div>
    </div>
  );
}
