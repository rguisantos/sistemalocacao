'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Gauge } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Botao, Campo, Dialogo, Tabela } from '@/components/ui/primitives';

export default function Produtos() {
  const { pode } = useAuth();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [aba, setAba] = useState<'todos' | 'deposito'>('todos');
  const [tipos, setTipos] = useState<any[]>([]);
  const [tamanhos, setTamanhos] = useState<any[]>([]);
  const [condicoes, setCondicoes] = useState<any[]>([]);
  const [ed, setEd] = useState<any | null>(null);
  const [erro, setErro] = useState('');

  const carregar = () => api.get(aba === 'todos' ? '/produtos' : '/produtos/em-deposito').then(setProdutos).catch(() => setProdutos([]));
  useEffect(() => { carregar(); }, [aba]);
  useEffect(() => {
    api.get('/tipos-produto').then(setTipos).catch(() => setTipos([]));
    api.get('/tamanhos').then(setTamanhos).catch(() => setTamanhos([]));
    api.get('/condicoes').then(setCondicoes).catch(() => setCondicoes([]));
  }, []);
  const nome = (lista: any[], id: string, campo = 'nome') => lista.find((x) => x.id === id)?.[campo] ?? '—';

  async function salvar() {
    setErro('');
    try {
      const base: any = { plaqueta: ed.plaqueta, descricao: ed.descricao, tipoId: ed.tipoId, tamanhoId: ed.tamanhoId, condicaoId: ed.condicaoId, chave: ed.chave };
      if (ed.id) await api.patch(`/produtos/${ed.id}`, { ...base, version: ed.version });
      else await api.post('/produtos', { ...base, contador: ed.contador ? Number(ed.contador) : undefined });
      setEd(null); carregar();
    } catch (e: any) { setErro(e.message); }
  }
  async function excluir(p: any) { if (confirm(`Excluir ${p.plaqueta}?`)) { await api.del(`/produtos/${p.id}`); carregar(); } }
  async function ajustarContador(p: any) {
    const v = window.prompt(`Novo contador para ${p.plaqueta}:`, String(p.contador ?? 0));
    if (v == null) return;
    try { await api.patch(`/produtos/${p.id}/contador`, { contador: Number(v), version: p.version }); carregar(); }
    catch (e: any) { alert(e.message); }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Produtos</h1>
        {pode('produtos.criar') && <Botao onClick={() => setEd({})}><Plus size={16} className="inline mr-1" /> Novo produto</Botao>}
      </div>

      <div className="flex gap-2">
        {(['todos', 'deposito'] as const).map((a) => (
          <button key={a} onClick={() => setAba(a)} className={`px-4 py-2 rounded-xl text-sm ${aba === a ? 'bg-feltro text-papel' : 'border border-borda'}`}>
            {a === 'todos' ? 'Todos' : 'Em depósito'}
          </button>
        ))}
      </div>

      <Tabela colunas={['Plaqueta', 'Descrição', 'Tipo', 'Contador', '']}>
        {produtos.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-suave">Nenhum produto.</td></tr>}
        {produtos.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3 valor">{p.plaqueta}</td>
            <td className="px-4 py-3">{p.descricao ?? '—'}</td>
            <td className="px-4 py-3">{nome(tipos, p.tipoId)}</td>
            <td className="px-4 py-3 valor">{p.contador}</td>
            <td className="px-4 py-3 text-right">
              <div className="flex gap-2 justify-end">
                {pode('produtos.alterar_contador') && <button onClick={() => ajustarContador(p)} title="Ajustar contador" className="text-suave hover:text-feltro"><Gauge size={16} /></button>}
                {pode('produtos.editar') && <button onClick={() => setEd({ ...p })} className="text-suave hover:text-feltro"><Pencil size={16} /></button>}
                {pode('produtos.excluir') && <button onClick={() => excluir(p)} className="text-suave hover:text-alerta"><Trash2 size={16} /></button>}
              </div>
            </td>
          </tr>
        ))}
      </Tabela>

      <Dialogo aberto={!!ed} aoFechar={() => setEd(null)} titulo={ed?.id ? 'Editar produto' : 'Novo produto'}>
        {ed && (
          <div className="flex flex-col gap-3">
            <Campo label="Plaqueta" value={ed.plaqueta ?? ''} onChange={(e) => setEd({ ...ed, plaqueta: e.target.value })} />
            <Campo label="Descrição (cor)" value={ed.descricao ?? ''} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} />
            <Sel label="Tipo" value={ed.tipoId} onChange={(v) => setEd({ ...ed, tipoId: v })} opcoes={tipos} />
            <Sel label="Tamanho" value={ed.tamanhoId} onChange={(v) => setEd({ ...ed, tamanhoId: v })} opcoes={tamanhos} campo="descricao" />
            <Sel label="Condição" value={ed.condicaoId} onChange={(v) => setEd({ ...ed, condicaoId: v })} opcoes={condicoes} campo="descricao" />
            <Campo label="Chave (opcional)" value={ed.chave ?? ''} onChange={(e) => setEd({ ...ed, chave: e.target.value })} />
            {!ed.id && <Campo label="Contador inicial" inputMode="numeric" value={ed.contador ?? ''} onChange={(e) => setEd({ ...ed, contador: e.target.value })} />}
            {erro && <p className="text-alerta text-sm">{erro}</p>}
            <div className="flex gap-2 justify-end mt-2">
              <Botao variante="secundario" onClick={() => setEd(null)}>Cancelar</Botao>
              <Botao onClick={salvar}>Salvar</Botao>
            </div>
          </div>
        )}
      </Dialogo>
    </div>
  );
}

function Sel({ label, value, onChange, opcoes, campo = 'nome' }: { label: string; value?: string; onChange: (v: string) => void; opcoes: any[]; campo?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-suave font-medium">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="border border-borda rounded-xl px-3 py-2 bg-white">
        <option value="">Selecione…</option>
        {opcoes.map((o) => <option key={o.id} value={o.id}>{o[campo]}</option>)}
      </select>
    </label>
  );
}
