'use client';
import { Fragment, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Loader2, Warehouse, History } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { MiniStat } from '@/components/ui/MiniStat';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

interface Produto {
  id: string; plaqueta: string; contador: number; descricao: string | null;
  tipoProduto: { id?: string; nome: string }; tamanho: { descricao: string } | null;
  condicao: { id?: string; descricao: string } | null;
  locacoes: { cliente: { nome: string } }[];
}
interface Aux { id: string; nome?: string; descricao?: string }
interface LocacaoHistorico {
  id: string; dataInicio: string; dataFim: string | null; status: string;
  finalizacaoTipo: string | null; totalRecebido: string;
  cliente: { nome: string };
  endereco: { logradouro: string; numero: string; bairro: string };
  deposito: { nome: string } | null;
  _count: { cobrancas: number };
}
interface ProdutoDeposito {
  id: string; plaqueta: string; contador: number;
  tipoProduto: { nome: string }; condicao: { descricao: string } | null;
  locacoes: { dataFim: string; deposito: { nome: string } | null; cliente: { nome: string } }[];
}

function HistoricoProduto({ produtoId }: { produtoId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['historico-produto', produtoId],
    queryFn: () => api<LocacaoHistorico[]>(`/api/relatorios/historico-produto/${produtoId}`),
  });
  if (isLoading) return <p className="p-3 text-sm text-muted-foreground">Carregando histórico…</p>;
  if (!data?.length) return <p className="p-3 text-sm text-muted-foreground">Sem locações registradas para este produto.</p>;
  return (
    <div className="p-3">
      <table className="w-full text-xs">
        <thead><tr className="text-left uppercase text-muted-foreground">
          <th className="pb-1">Cliente / Endereço</th><th>Período</th><th>Situação</th>
          <th className="text-right">Cobranças</th><th className="pb-1 text-right">Total recebido</th>
        </tr></thead>
        <tbody>
          {data.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="py-1.5">
                <span className="font-medium">{l.cliente.nome}</span>
                <span className="text-muted-foreground"> · {l.endereco.logradouro}, {l.endereco.numero}</span>
              </td>
              <td className="text-muted-foreground">
                {new Date(l.dataInicio).toLocaleDateString('pt-BR')}
                {' → '}
                {l.dataFim ? new Date(l.dataFim).toLocaleDateString('pt-BR') : 'atual'}
              </td>
              <td>
                {l.status === 'ATIVA'
                  ? <Badge variante="success">Ativa</Badge>
                  : l.finalizacaoTipo === 'DEPOSITO'
                    ? <Badge variante="muted">Depósito{l.deposito ? ` · ${l.deposito.nome}` : ''}</Badge>
                    : <Badge variante="muted">Relocada</Badge>}
              </td>
              <td className="text-right">{l._count.cobrancas}</td>
              <td className="text-right font-semibold">
                {Number(l.totalRecebido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FORM_VAZIO = { plaqueta: '', tipoProdutoId: '', tamanhoId: '', condicaoId: '', contador: '0' };

export default function ProdutosPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [aba, setAba] = useState<'todos' | 'deposito'>('todos');
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [modalNovo, setModalNovo] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<Produto | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const [formEdit, setFormEdit] = useState({ descricao: '', condicaoId: '', contador: '' });

  const { data: produtos, isLoading } = useQuery({ queryKey: ['produtos'], queryFn: () => api<Produto[]>('/api/produtos') });
  const { data: emDeposito } = useQuery({
    queryKey: ['produtos-deposito'],
    queryFn: () => api<ProdutoDeposito[]>('/api/produtos/em-deposito'),
  });
  const { data: tipos } = useQuery({ queryKey: ['tipos-produto'], queryFn: () => api<Aux[]>('/api/tipos-produto') });
  const { data: tamanhos } = useQuery({ queryKey: ['tamanhos'], queryFn: () => api<Aux[]>('/api/tamanhos') });
  const { data: condicoes } = useQuery({ queryKey: ['condicoes'], queryFn: () => api<Aux[]>('/api/condicoes') });

  const filtrados = useMemo(
    () => (produtos ?? []).filter((p) =>
      (!busca || p.plaqueta.toLowerCase().includes(busca.toLowerCase())) &&
      (!tipoFiltro || p.tipoProduto?.nome === tipoFiltro)
    ),
    [produtos, busca, tipoFiltro]
  );

  const stats = useMemo(() => {
    const lista = produtos ?? [];
    const locados = lista.filter((p) => p.locacoes.length > 0).length;
    return {
      total: lista.length,
      locados,
      disponiveis: lista.length - locados,
      deposito: emDeposito?.length ?? 0,
    };
  }, [produtos, emDeposito]);

  const criar = useMutation({
    mutationFn: () => api('/api/produtos', {
      method: 'POST',
      body: JSON.stringify({
        plaqueta: form.plaqueta, tipoProdutoId: form.tipoProdutoId,
        tamanhoId: form.tamanhoId || null, condicaoId: form.condicaoId || null,
        contador: parseInt(form.contador, 10) || 0,
      }),
    }),
    onSuccess: () => {
      setModalNovo(false); setForm(FORM_VAZIO);
      qc.invalidateQueries({ queryKey: ['produtos'] });
      toast({ titulo: 'Produto cadastrado' });
    },
    onError: (e: Error) => setErro(e.message),
  });

  const editar = useMutation({
    mutationFn: () => api(`/api/produtos/${editando!.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        descricao: formEdit.descricao || null,
        condicaoId: formEdit.condicaoId || null,
        contador: parseInt(formEdit.contador, 10) || 0,
      }),
    }),
    onSuccess: () => { setEditando(null); qc.invalidateQueries({ queryKey: ['produtos'] }); toast({ titulo: 'Produto atualizado' }); },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <PageHeader icone={Package} titulo="Produtos" descricao="Mesas, jukeboxes e demais equipamentos do patrimônio">
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          {([['todos', 'Todos'], ['deposito', 'Em depósito']] as const).map(([v, r]) => (
            <button key={v} onClick={() => setAba(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                aba === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}>
              {r}{v === 'deposito' && stats.deposito > 0 ? ` (${stats.deposito})` : ''}
            </button>
          ))}
        </div>
        <button onClick={() => { setErro(''); setForm(FORM_VAZIO); setModalNovo(true); }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo Produto
        </button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-4 gap-3">
        <MiniStat rotulo="Total" valor={stats.total} />
        <MiniStat rotulo="Locados" valor={stats.locados} cor="text-primary" />
        <MiniStat rotulo="Disponíveis" valor={stats.disponiveis} cor="text-amber-600" />
        <MiniStat rotulo="Em depósito" valor={stats.deposito} cor="text-muted-foreground" />
      </div>

      {aba === 'deposito' ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="p-3">Plaqueta</th><th>Tipo</th><th>Condição</th>
              <th>Depósito</th><th>Último cliente</th><th>Recolhida em</th>
            </tr></thead>
            <tbody>
              {emDeposito?.map((p) => {
                const ult = p.locacoes[0];
                return (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{p.plaqueta}</td>
                    <td>{p.tipoProduto.nome}</td>
                    <td>{p.condicao?.descricao ?? '—'}</td>
                    <td><Badge variante="outline"><Warehouse className="h-3 w-3" />{ult?.deposito?.nome ?? '—'}</Badge></td>
                    <td className="text-muted-foreground">{ult?.cliente?.nome ?? '—'}</td>
                    <td className="text-muted-foreground">{ult?.dataFim ? new Date(ult.dataFim).toLocaleDateString('pt-BR') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(emDeposito?.length ?? 0) === 0 && (
            <EmptyState icone={Warehouse} titulo="Nenhum produto em depósito"
              descricao="Produtos recolhidos nas finalizações de locação aparecem aqui." />
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row">
            <SearchInput placeholder="Buscar por plaqueta…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <select className="rounded-lg border px-3 py-2 text-sm sm:w-52" value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}>
              <option value="">Todos os tipos</option>
              {tipos?.map((t) => <option key={t.id} value={t.nome ?? ''}>{t.nome}</option>)}
            </select>
          </div>

          {isLoading ? (
            <TableSkeleton linhas={6} />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3">Plaqueta</th><th>Tipo</th><th>Tamanho</th><th>Condição</th><th>Contador</th><th>Situação</th><th></th>
                </tr></thead>
                <tbody>
                  {filtrados.map((p) => (
                    <Fragment key={p.id}>
                      <tr className="border-b last:border-0">
                        <td className="p-3 font-semibold">{p.plaqueta}</td>
                        <td>{p.tipoProduto.nome}</td>
                        <td className="text-muted-foreground">{p.tamanho?.descricao ?? '—'}</td>
                        <td className="text-muted-foreground">{p.condicao?.descricao ?? '—'}</td>
                        <td className="tabular-nums">{p.contador}</td>
                        <td>
                          {p.locacoes.length > 0
                            ? <Badge variante="success">Locado · {p.locacoes[0].cliente.nome}</Badge>
                            : <Badge variante="muted">Disponível</Badge>}
                        </td>
                        <td className="pr-3 text-right text-xs whitespace-nowrap">
                          <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                            onClick={() => setHistoricoAberto(historicoAberto === p.id ? null : p.id)}>
                            <History className="h-3 w-3" />
                            {historicoAberto === p.id ? 'fechar' : 'histórico'}
                          </button>
                          <span className="mx-1 text-muted-foreground/50">·</span>
                          <button className="text-muted-foreground hover:text-primary"
                            onClick={() => { setErro(''); setEditando(p); setFormEdit({
                              descricao: p.descricao ?? '', condicaoId: '', contador: String(p.contador),
                            }); }}>
                            editar
                          </button>
                        </td>
                      </tr>
                      {historicoAberto === p.id && (
                        <tr className="border-b bg-muted/40">
                          <td colSpan={7}><HistoricoProduto produtoId={p.id} /></td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {filtrados.length === 0 && (
                <EmptyState icone={Package} titulo="Nenhum produto encontrado"
                  descricao={busca || tipoFiltro ? 'Ajuste a busca ou o filtro de tipo.' : 'Cadastre o primeiro equipamento do patrimônio.'}
                  acao={!busca && !tipoFiltro ? { rotulo: '+ Novo Produto', onClick: () => setModalNovo(true) } : undefined} />
              )}
            </div>
          )}
        </>
      )}

      <Modal aberto={modalNovo} fechar={() => setModalNovo(false)}
        titulo="Novo Produto" descricao="A plaqueta identifica o patrimônio e é única.">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Plaqueta *</label>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Ex.: MS-001"
                value={form.plaqueta} onChange={(e) => setForm({ ...form, plaqueta: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo *</label>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.tipoProdutoId}
                onChange={(e) => setForm({ ...form, tipoProdutoId: e.target.value })}>
                <option value="">Selecione…</option>
                {tipos?.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tamanho</label>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.tamanhoId}
                onChange={(e) => setForm({ ...form, tamanhoId: e.target.value })}>
                <option value="">—</option>
                {tamanhos?.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Condição</label>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.condicaoId}
                onChange={(e) => setForm({ ...form, condicaoId: e.target.value })}>
                <option value="">—</option>
                {condicoes?.map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Contador inicial</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.contador} onChange={(e) => setForm({ ...form, contador: e.target.value.replace(/\D/g, '') })} />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setModalNovo(false)}
              className="rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">Cancelar</button>
            <button onClick={() => criar.mutate()} disabled={!form.plaqueta || !form.tipoProdutoId || criar.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {criar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cadastrar produto
            </button>
          </div>
        </div>
      </Modal>

      <Modal aberto={!!editando} fechar={() => setEditando(null)}
        titulo={`Editar — ${editando?.plaqueta ?? ''}`}
        descricao="Alterar o contador é auditado — use apenas para correção de leitura.">
        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Descrição</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Ex.: Azul/Branco"
              value={formEdit.descricao} onChange={(e) => setFormEdit({ ...formEdit, descricao: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Condição</label>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={formEdit.condicaoId}
                onChange={(e) => setFormEdit({ ...formEdit, condicaoId: e.target.value })}>
                <option value="">Manter atual</option>
                {condicoes?.map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Contador</label>
              <input className="w-full rounded-lg border px-3 py-2 text-sm"
                value={formEdit.contador} onChange={(e) => setFormEdit({ ...formEdit, contador: e.target.value.replace(/\D/g, '') })} />
            </div>
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setEditando(null)}
              className="rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">Cancelar</button>
            <button onClick={() => editar.mutate()} disabled={editar.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {editar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar alterações
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
