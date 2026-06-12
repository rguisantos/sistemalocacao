'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Loader2, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { MiniStat } from '@/components/ui/MiniStat';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface Cliente {
  id: string; nome: string; cpfCnpj: string | null; tipo: string;
  telefones: { numero: string; tipo: string }[];
  rota: { id: string; nome: string };
  enderecos: { id: string; logradouro: string; numero: string; bairro: string }[];
  _count: { locacoes: number };
}
interface Rota { id: string; nome: string }

const FORM_VAZIO = { nome: '', cpfCnpj: '', rotaId: '', telefone: '' };

export default function ClientesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [rotaFiltro, setRotaFiltro] = useState('');
  const [modalNovo, setModalNovo] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');

  const { data: clientes, isLoading } = useQuery({
    queryKey: ['clientes', busca],
    queryFn: () => api<Cliente[]>(`/api/clientes${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`),
  });
  const { data: rotas } = useQuery({ queryKey: ['rotas'], queryFn: () => api<Rota[]>('/api/rotas') });

  const filtrados = useMemo(
    () => (clientes ?? []).filter((c) => !rotaFiltro || c.rota?.id === rotaFiltro),
    [clientes, rotaFiltro]
  );

  const stats = useMemo(() => {
    const lista = clientes ?? [];
    const comLocacao = lista.filter((c) => c._count.locacoes > 0).length;
    return {
      total: lista.length,
      comLocacao,
      semLocacao: lista.length - comLocacao,
    };
  }, [clientes]);

  const criar = useMutation({
    mutationFn: () => api('/api/clientes', {
      method: 'POST',
      body: JSON.stringify({
        nome: form.nome, cpfCnpj: form.cpfCnpj || null, rotaId: form.rotaId,
        telefones: form.telefone ? [{ numero: form.telefone, tipo: 'celular' }] : [],
      }),
    }),
    onSuccess: () => {
      setModalNovo(false); setForm(FORM_VAZIO);
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast({ titulo: 'Cliente cadastrado' });
    },
    onError: (e: Error) => setErro(e.message),
  });

  const editar = useMutation({
    mutationFn: () => api(`/api/clientes/${editando!.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        nome: form.nome,
        rotaId: form.rotaId,
        telefones: form.telefone ? [{ numero: form.telefone, tipo: 'celular' }] : [],
      }),
    }),
    onSuccess: () => { setEditando(null); qc.invalidateQueries({ queryKey: ['clientes'] }); toast({ titulo: 'Cliente atualizado' }); },
    onError: (e: Error) => setErro(e.message),
  });

  function abrirNovo() {
    setErro(''); setForm(FORM_VAZIO); setModalNovo(true);
  }
  function abrirEdicao(c: Cliente, e: React.MouseEvent) {
    e.stopPropagation();
    setErro('');
    setForm({ nome: c.nome, cpfCnpj: c.cpfCnpj ?? '', telefone: c.telefones?.[0]?.numero ?? '', rotaId: c.rota?.id ?? '' });
    setEditando(c);
  }

  const FormCliente = ({ edicao }: { edicao: boolean }) => (
    <div className="grid gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium">Nome *</label>
        <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Nome do cliente ou estabelecimento"
          value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
      </div>
      {!edicao && (
        <div>
          <label className="mb-1 block text-sm font-medium">CPF/CNPJ</label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Somente números"
            value={form.cpfCnpj} onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })} />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Telefone</label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="(00) 00000-0000"
            value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Rota *</label>
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.rotaId}
            onChange={(e) => setForm({ ...form, rotaId: e.target.value })}>
            <option value="">Selecione…</option>
            {rotas?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={() => { setModalNovo(false); setEditando(null); }}
          className="rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">
          Cancelar
        </button>
        <button
          onClick={() => (edicao ? editar.mutate() : criar.mutate())}
          disabled={!form.nome || !form.rotaId || criar.isPending || editar.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {(criar.isPending || editar.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
          {edicao ? 'Salvar alterações' : 'Cadastrar cliente'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl p-8">
      <PageHeader icone={Users} titulo="Clientes" descricao="Estabelecimentos e pontos onde os equipamentos estão instalados">
        <button onClick={abrirNovo}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo Cliente
        </button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <MiniStat rotulo="Total de clientes" valor={stats.total} />
        <MiniStat rotulo="Com locação ativa" valor={stats.comLocacao} cor="text-primary" />
        <MiniStat rotulo="Sem locação" valor={stats.semLocacao} cor="text-muted-foreground" />
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row">
        <SearchInput placeholder="Buscar por nome ou CPF/CNPJ…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="rounded-lg border px-3 py-2 text-sm sm:w-52" value={rotaFiltro}
          onChange={(e) => setRotaFiltro(e.target.value)}>
          <option value="">Todas as rotas</option>
          {rotas?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton linhas={6} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Cliente</th><th>Rota</th><th>Endereços</th><th>Locações</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                  onClick={() => router.push(`/painel/clientes/${c.id}`)}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar nome={c.nome} />
                      <div>
                        <p className="font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.cpfCnpj || (c.telefones?.[0]?.numero ?? '—')}</p>
                      </div>
                    </div>
                  </td>
                  <td><Badge variante="outline"><MapPin className="h-3 w-3" />{c.rota?.nome}</Badge></td>
                  <td className="max-w-56 truncate text-xs text-muted-foreground">
                    {c.enderecos.map((e) => `${e.logradouro}, ${e.numero}`).join(' · ') || '—'}
                  </td>
                  <td>
                    {c._count.locacoes > 0
                      ? <Badge variante="success">{c._count.locacoes} ativa{c._count.locacoes > 1 ? 's' : ''}</Badge>
                      : <Badge variante="muted">nenhuma</Badge>}
                  </td>
                  <td className="pr-3 text-right">
                    <button onClick={(e) => abrirEdicao(c, e)}
                      className="text-xs text-muted-foreground hover:text-primary">editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 && (
            <EmptyState icone={Users} titulo="Nenhum cliente encontrado"
              descricao={busca || rotaFiltro ? 'Ajuste a busca ou o filtro de rota.' : 'Cadastre o primeiro cliente para começar.'}
              acao={!busca && !rotaFiltro ? { rotulo: '+ Novo Cliente', onClick: abrirNovo } : undefined} />
          )}
        </div>
      )}

      <Modal aberto={modalNovo} fechar={() => setModalNovo(false)}
        titulo="Novo Cliente" descricao="O endereço de instalação é adicionado na página do cliente.">
        <FormCliente edicao={false} />
      </Modal>

      <Modal aberto={!!editando} fechar={() => setEditando(null)}
        titulo={`Editar — ${editando?.nome ?? ''}`} descricao="Transferir de rota exige permissão própria.">
        <FormCliente edicao />
      </Modal>
    </div>
  );
}
