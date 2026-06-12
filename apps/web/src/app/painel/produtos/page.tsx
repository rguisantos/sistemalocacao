'use client';
import { Fragment, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Produto {
  id: string; plaqueta: string; contador: number; descricao: string | null;
  tipoProduto: { nome: string }; tamanho: { descricao: string } | null;
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

function HistoricoProduto({ produtoId }: { produtoId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['historico-produto', produtoId],
    queryFn: () => api<LocacaoHistorico[]>(`/api/relatorios/historico-produto/${produtoId}`),
  });
  if (isLoading) return <p className="p-3 text-sm text-stone-400">Carregando histórico…</p>;
  if (!data?.length) return <p className="p-3 text-sm text-stone-400">Sem locações registradas para este produto.</p>;
  return (
    <div className="p-3">
      <table className="w-full text-xs">
        <thead><tr className="text-left uppercase text-stone-400">
          <th className="pb-1">Cliente / Endereço</th><th>Período</th><th>Situação</th>
          <th className="text-right">Cobranças</th><th className="pb-1 text-right">Total recebido</th>
        </tr></thead>
        <tbody>
          {data.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="py-1.5">
                <span className="font-medium">{l.cliente.nome}</span>
                <span className="text-stone-400"> · {l.endereco.logradouro}, {l.endereco.numero}</span>
              </td>
              <td className="text-stone-500">
                {new Date(l.dataInicio).toLocaleDateString('pt-BR')}
                {' → '}
                {l.dataFim ? new Date(l.dataFim).toLocaleDateString('pt-BR') : 'atual'}
              </td>
              <td>
                {l.status === 'ATIVA'
                  ? <span className="text-feltro">Ativa</span>
                  : l.finalizacaoTipo === 'DEPOSITO'
                    ? <span className="text-stone-500">Depósito{l.deposito ? ` (${l.deposito.nome})` : ''}</span>
                    : <span className="text-stone-500">Relocada</span>}
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
interface ProdutoDeposito {
  id: string; plaqueta: string; contador: number;
  tipoProduto: { nome: string }; condicao: { descricao: string } | null;
  locacoes: { dataFim: string; deposito: { nome: string } | null; cliente: { nome: string } }[];
}

export default function ProdutosPage() {
  const qc = useQueryClient();
  const [aba, setAba] = useState<'todos' | 'deposito'>('todos');
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState({ plaqueta: '', tipoProdutoId: '', tamanhoId: '', condicaoId: '', contador: '0' });
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<Produto | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const [formEdit, setFormEdit] = useState({ descricao: '', condicaoId: '', contador: '' });

  const editar = useMutation({
    mutationFn: () => api(`/api/produtos/${editando!.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        descricao: formEdit.descricao || null,
        condicaoId: formEdit.condicaoId || null,
        contador: parseInt(formEdit.contador, 10) || 0,
      }),
    }),
    onSuccess: () => { setEditando(null); qc.invalidateQueries({ queryKey: ['produtos'] }); },
    onError: (e: Error) => setErro(e.message),
  });

  const { data: produtos } = useQuery({ queryKey: ['produtos'], queryFn: () => api<Produto[]>('/api/produtos') });
  const { data: emDeposito } = useQuery({
    queryKey: ['produtos-deposito'],
    queryFn: () => api<ProdutoDeposito[]>('/api/produtos/em-deposito'),
    enabled: aba === 'deposito',
  });
  const { data: tipos } = useQuery({ queryKey: ['tipos-produto'], queryFn: () => api<Aux[]>('/api/tipos-produto') });
  const { data: tamanhos } = useQuery({ queryKey: ['tamanhos'], queryFn: () => api<Aux[]>('/api/tamanhos') });
  const { data: condicoes } = useQuery({ queryKey: ['condicoes'], queryFn: () => api<Aux[]>('/api/condicoes') });

  const criar = useMutation({
    mutationFn: () => api('/api/produtos', {
      method: 'POST',
      body: JSON.stringify({
        plaqueta: form.plaqueta, tipoProdutoId: form.tipoProdutoId,
        tamanhoId: form.tamanhoId || null, condicaoId: form.condicaoId || null,
        contador: parseInt(form.contador, 10) || 0,
      }),
    }),
    onSuccess: () => { setNovo(false); qc.invalidateQueries({ queryKey: ['produtos'] }); },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-feltro">Produtos</h1>
        <div className="flex gap-2">
          {([['todos', 'Todos'], ['deposito', 'Em depósito']] as const).map(([v, r]) => (
            <button key={v} onClick={() => setAba(v)}
              className={`rounded-lg px-3 py-1.5 text-sm ${aba === v ? 'bg-feltro text-white' : 'bg-white'}`}>
              {r}{v === 'deposito' && emDeposito ? ` (${emDeposito.length})` : ''}
            </button>
          ))}
          <button onClick={() => setNovo(!novo)} className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white">
            {novo ? 'Cancelar' : '+ Novo produto'}
          </button>
        </div>
      </div>

      {aba === 'deposito' && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-stone-50 text-left text-xs uppercase text-stone-400">
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
                    <td className="font-medium text-feltro">{ult?.deposito?.nome ?? '—'}</td>
                    <td className="text-stone-500">{ult?.cliente?.nome ?? '—'}</td>
                    <td className="text-stone-500">{ult?.dataFim ? new Date(ult.dataFim).toLocaleDateString('pt-BR') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(emDeposito?.length ?? 0) === 0 && <p className="p-6 text-center text-stone-400">Nenhum produto em depósito.</p>}
        </div>
      )}

      {aba === 'todos' && (<>

      {novo && (
        <div className="mb-6 grid gap-3 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-5">
          <input className="rounded-lg border px-3 py-2" placeholder="Plaqueta *" value={form.plaqueta} onChange={(e) => setForm({ ...form, plaqueta: e.target.value })} />
          <select className="rounded-lg border px-3 py-2" value={form.tipoProdutoId} onChange={(e) => setForm({ ...form, tipoProdutoId: e.target.value })}>
            <option value="">Tipo *</option>
            {tipos?.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2" value={form.tamanhoId} onChange={(e) => setForm({ ...form, tamanhoId: e.target.value })}>
            <option value="">Tamanho</option>
            {tamanhos?.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2" value={form.condicaoId} onChange={(e) => setForm({ ...form, condicaoId: e.target.value })}>
            <option value="">Condição</option>
            {condicoes?.map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
          </select>
          <input className="rounded-lg border px-3 py-2" placeholder="Contador" value={form.contador} onChange={(e) => setForm({ ...form, contador: e.target.value.replace(/\D/g, '') })} />
          {erro && <p className="text-sm text-red-600 sm:col-span-5">{erro}</p>}
          <button onClick={() => criar.mutate()} disabled={!form.plaqueta || !form.tipoProdutoId || criar.isPending}
            className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-5">
            Salvar produto
          </button>
        </div>
      )}

      {editando && (
        <div className="mb-6 grid gap-3 rounded-xl border-2 border-feltro/30 bg-white p-5 shadow-sm sm:grid-cols-4">
          <p className="text-sm font-semibold text-feltro sm:col-span-4">
            Editando: {editando.plaqueta}
            <span className="ml-2 font-normal text-amber-600">
              (alterar o contador é auditado — use só para correção de leitura)
            </span>
          </p>
          <input className="rounded-lg border px-3 py-2" placeholder="Descrição" value={formEdit.descricao}
            onChange={(e) => setFormEdit({ ...formEdit, descricao: e.target.value })} />
          <select className="rounded-lg border px-3 py-2" value={formEdit.condicaoId}
            onChange={(e) => setFormEdit({ ...formEdit, condicaoId: e.target.value })}>
            <option value="">Condição (manter atual)</option>
            {condicoes?.map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
          </select>
          <input className="rounded-lg border px-3 py-2" placeholder="Contador" value={formEdit.contador}
            onChange={(e) => setFormEdit({ ...formEdit, contador: e.target.value.replace(/\D/g, '') })} />
          <div className="flex gap-2">
            <button onClick={() => editar.mutate()} disabled={editar.isPending}
              className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar</button>
            <button onClick={() => setEditando(null)} className="rounded-lg border px-4 py-2 text-sm text-stone-500">Cancelar</button>
          </div>
          {erro && <p className="text-sm text-red-600 sm:col-span-4">{erro}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-stone-50 text-left text-xs uppercase text-stone-400">
            <th className="p-3">Plaqueta</th><th>Tipo</th><th>Tamanho</th><th>Condição</th><th>Contador</th><th>Situação</th><th></th>
          </tr></thead>
          <tbody>
            {produtos?.map((p) => (
              <Fragment key={p.id}>
                <tr className="border-b last:border-0">
                  <td className="p-3 font-medium">{p.plaqueta}</td>
                  <td>{p.tipoProduto.nome}</td>
                  <td>{p.tamanho?.descricao ?? '—'}</td>
                  <td>{p.condicao?.descricao ?? '—'}</td>
                  <td>{p.contador}</td>
                  <td>{p.locacoes.length > 0
                    ? <span className="text-feltro">Locado · {p.locacoes[0].cliente.nome}</span>
                    : <span className="text-stone-400">Disponível</span>}</td>
                  <td className="pr-3 text-right text-xs whitespace-nowrap">
                    <button className="text-stone-400 hover:text-feltro"
                      onClick={() => setHistoricoAberto(historicoAberto === p.id ? null : p.id)}>
                      {historicoAberto === p.id ? 'fechar' : 'histórico'}
                    </button>
                    <span className="mx-1 text-stone-300">·</span>
                    <button className="text-stone-400 hover:text-feltro"
                      onClick={() => { setErro(''); setEditando(p); setFormEdit({
                        descricao: p.descricao ?? '', condicaoId: '', contador: String(p.contador),
                      }); }}>
                      editar
                    </button>
                  </td>
                </tr>
                {historicoAberto === p.id && (
                  <tr className="border-b bg-stone-50/60">
                    <td colSpan={7}><HistoricoProduto produtoId={p.id} /></td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      </>)}
    </div>
  );
}
