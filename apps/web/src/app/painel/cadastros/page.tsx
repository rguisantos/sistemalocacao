'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MapPin } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

interface Rota { id: string; nome: string; _count: { clientes: number } }
interface Deposito { id: string; nome: string; cidade: string | null }
interface Aux { id: string; nome?: string; descricao?: string }

function SecaoAuxiliar({ titulo, endpoint, campo }: { titulo: string; endpoint: string; campo: 'nome' | 'descricao' }) {
  const qc = useQueryClient();
  const [valor, setValor] = useState('');
  const { data: itens } = useQuery({ queryKey: [endpoint], queryFn: () => api<Aux[]>(`/api/${endpoint}`) });

  const criar = useMutation({
    mutationFn: () => api(`/api/${endpoint}`, { method: 'POST', body: JSON.stringify({ [campo]: valor }) }),
    onSuccess: () => { setValor(''); qc.invalidateQueries({ queryKey: [endpoint] }); },
  });
  const remover = useMutation({
    mutationFn: (id: string) => api(`/api/${endpoint}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [endpoint] }),
  });

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-base font-bold text-feltro">{titulo}</h2>
      <div className="mb-3 flex gap-2">
        <input className="flex-1 rounded-lg border px-3 py-2 text-sm" placeholder={titulo.slice(0, -1)}
          value={valor} onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && valor && criar.mutate()} />
        <button onClick={() => criar.mutate()} disabled={!valor}
          className="rounded-lg bg-feltro px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">＋</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {itens?.map((i) => (
          <span key={i.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
            {i[campo]}
            <button onClick={() => remover.mutate(i.id)} className="text-muted-foreground hover:text-destructive">×</button>
          </span>
        ))}
        {(itens?.length ?? 0) === 0 && <span className="text-sm text-muted-foreground">Nenhum cadastrado.</span>}
      </div>
    </section>
  );
}

export default function CadastrosPage() {
  const qc = useQueryClient();
  const [nomeRota, setNomeRota] = useState('');
  const [nomeDeposito, setNomeDeposito] = useState('');
  const [cidadeDeposito, setCidadeDeposito] = useState('');

  const { data: rotas } = useQuery({ queryKey: ['rotas'], queryFn: () => api<Rota[]>('/api/rotas') });
  const { data: depositos } = useQuery({ queryKey: ['depositos'], queryFn: () => api<Deposito[]>('/api/depositos') });

  const criarRota = useMutation({
    mutationFn: () => api('/api/rotas', { method: 'POST', body: JSON.stringify({ nome: nomeRota }) }),
    onSuccess: () => { setNomeRota(''); qc.invalidateQueries({ queryKey: ['rotas'] }); },
  });
  const criarDeposito = useMutation({
    mutationFn: () => api('/api/depositos', { method: 'POST', body: JSON.stringify({ nome: nomeDeposito, cidade: cidadeDeposito || undefined }) }),
    onSuccess: () => { setNomeDeposito(''); setCidadeDeposito(''); qc.invalidateQueries({ queryKey: ['depositos'] }); },
  });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <PageHeader icone={MapPin} titulo="Rotas e Depósitos"
        descricao="Regiões de atendimento, depósitos e cadastros auxiliares dos produtos" />
      <div className="gap-6 lg:grid lg:grid-cols-2">
      <section className="mb-6 rounded-xl border bg-card p-5 shadow-sm lg:mb-0">
        <h2 className="mb-4 text-lg font-bold text-feltro">Rotas</h2>
        <div className="mb-4 flex gap-2">
          <input className="flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Nome da rota" value={nomeRota} onChange={(e) => setNomeRota(e.target.value)} />
          <button onClick={() => criarRota.mutate()} disabled={!nomeRota} className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Criar</button>
        </div>
        {rotas?.map((r) => (
          <div key={r.id} className="flex justify-between border-b py-2 text-sm last:border-0">
            <span>{r.nome}</span><span className="text-muted-foreground">{r._count.clientes} cliente(s)</span>
          </div>
        ))}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-feltro">Depósitos</h2>
        <div className="mb-4 flex gap-2">
          <input className="flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Nome" value={nomeDeposito} onChange={(e) => setNomeDeposito(e.target.value)} />
          <input className="w-32 rounded-lg border px-3 py-2 text-sm" placeholder="Cidade" value={cidadeDeposito} onChange={(e) => setCidadeDeposito(e.target.value)} />
          <button onClick={() => criarDeposito.mutate()} disabled={!nomeDeposito} className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Criar</button>
        </div>
        {depositos?.map((d) => (
          <div key={d.id} className="flex justify-between border-b py-2 text-sm last:border-0">
            <span>{d.nome}</span><span className="text-muted-foreground">{d.cidade ?? ''}</span>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:col-span-2 lg:grid-cols-3">
        <SecaoAuxiliar titulo="Tipos de produto" endpoint="tipos-produto" campo="nome" />
        <SecaoAuxiliar titulo="Tamanhos" endpoint="tamanhos" campo="descricao" />
        <SecaoAuxiliar titulo="Condições" endpoint="condicoes" campo="descricao" />
      </div>
      </div>
    </div>
  );
}
