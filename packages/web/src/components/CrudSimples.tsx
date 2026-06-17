'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Botao, Campo, Dialogo, Tabela } from '@/components/ui/primitives';

interface Config { titulo: string; endpoint: string; campo: 'nome' | 'descricao'; rotuloCampo: string; perm: { criar: string; editar: string; excluir: string }; }

/** CRUD reutilizável para cadastros simples (rotas, depósitos, tipos, tamanhos, condições). */
export function CrudSimples({ titulo, endpoint, campo, rotuloCampo, perm }: Config) {
  const { pode } = useAuth();
  const [itens, setItens] = useState<any[]>([]);
  const [editando, setEditando] = useState<any | null>(null);
  const [erro, setErro] = useState('');

  const carregar = () => api.get(endpoint).then(setItens).catch(() => setItens([]));
  useEffect(() => { carregar(); }, []);

  async function salvar() {
    setErro('');
    try {
      if (editando?.id) await api.patch(`${endpoint}/${editando.id}`, { [campo]: editando[campo], version: editando.version });
      else await api.post(endpoint, { [campo]: editando?.[campo] });
      setEditando(null); carregar();
    } catch (e: any) { setErro(e.message); }
  }
  async function excluir(it: any) { if (confirm(`Excluir "${it[campo]}"?`)) { await api.del(`${endpoint}/${it.id}`); carregar(); } }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{titulo}</h1>
        {pode(perm.criar) && <Botao onClick={() => setEditando({})}><Plus size={16} className="inline mr-1" /> Novo</Botao>}
      </div>
      <Tabela colunas={[rotuloCampo, '']}>
        {itens.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-suave">Nenhum registro ainda.</td></tr>}
        {itens.map((it) => (
          <tr key={it.id}>
            <td className="px-4 py-3">{it[campo]}</td>
            <td className="px-4 py-3 text-right">
              <div className="flex gap-2 justify-end">
                {pode(perm.editar) && <button onClick={() => setEditando(it)} className="text-suave hover:text-feltro"><Pencil size={16} /></button>}
                {pode(perm.excluir) && <button onClick={() => excluir(it)} className="text-suave hover:text-alerta"><Trash2 size={16} /></button>}
              </div>
            </td>
          </tr>
        ))}
      </Tabela>
      <Dialogo aberto={!!editando} aoFechar={() => setEditando(null)} titulo={editando?.id ? `Editar ${titulo}` : `Novo ${titulo}`}>
        <div className="flex flex-col gap-3">
          <Campo label={rotuloCampo} value={editando?.[campo] ?? ''} onChange={(e) => setEditando({ ...editando, [campo]: e.target.value })} />
          {erro && <p className="text-alerta text-sm">{erro}</p>}
          <div className="flex gap-2 justify-end mt-2">
            <Botao variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
            <Botao onClick={salvar}>Salvar</Botao>
          </div>
        </div>
      </Dialogo>
    </div>
  );
}
