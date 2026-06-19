'use client';
import { useState } from 'react';
import { Plus, Pencil, Trash2, Gauge, Package } from 'lucide-react';
import { useApi, useApiMutation, revalidar } from '@/lib/swr';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Botao, Campo, Select, Modal, ConfirmModal, Tabela, Badge, Tabs, Header, SearchInput, SkeletonTable, toast } from '@/components/ui/primitives';

export default function Produtos() {
  const { pode } = useAuth();
  const [aba, setAba] = useState('todos');
  const [busca, setBusca] = useState('');
  const [ed, setEd] = useState<any | null>(null);
  const [excluindo, setExcluindo] = useState<any | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const endpoint = aba === 'deposito' ? '/produtos/em-deposito' : '/produtos';
  const { data: produtos, isLoading } = useApi<any[]>(endpoint);
  const { data: tipos } = useApi<any[]>('/tipos-produto');
  const { data: tamanhos } = useApi<any[]>('/tamanhos');
  const { data: condicoes } = useApi<any[]>('/condicoes');

  const { remover } = useApiMutation();

  const nome = (lista: any[] | undefined, id: string, campo = 'nome') => lista?.find((x) => x.id === id)?.[campo] ?? '—';

  // Filtro client-side
  const filtrados = (produtos ?? []).filter((p) => {
    if (busca && !p.plaqueta?.toLowerCase().includes(busca.toLowerCase()) && !(p.descricao ?? '').toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  async function salvar() {
    setErro(''); setSalvando(true);
    try {
      const base: any = { plaqueta: ed.plaqueta, descricao: ed.descricao, tipoId: ed.tipoId, tamanhoId: ed.tamanhoId, condicaoId: ed.condicaoId, chave: ed.chave };
      if (ed.id) await api.patch(`/produtos/${ed.id}`, { ...base, version: ed.version });
      else await api.post('/produtos', { ...base, contador: ed.contador ? Number(ed.contador) : undefined });
      toast(ed.id ? 'Produto atualizado!' : 'Produto criado!', 'sucesso');
      setEd(null); revalidar('/produtos');
    } catch (e: any) { setErro(e.message); toast(e.message, 'erro'); }
    finally { setSalvando(false); }
  }

  async function excluirProduto() {
    if (!excluindo) return;
    try {
      await remover(`/produtos/${excluindo.id}`);
      toast('Produto excluído', 'sucesso');
      revalidar('/produtos');
    } catch (e: any) { toast(e.message, 'erro'); }
    setExcluindo(null);
  }

  async function ajustarContador(p: any) {
    const v = window.prompt(`Novo contador para ${p.plaqueta}:`, String(p.contador ?? 0));
    if (v == null) return;
    try {
      await api.patch(`/produtos/${p.id}/contador`, { contador: Number(v), version: p.version });
      toast('Contador ajustado!', 'sucesso');
      revalidar('/produtos');
    } catch (e: any) { toast(e.message, 'erro'); }
  }

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Produtos" subtitulo={`${filtrados.length} produto${filtrados.length !== 1 ? 's' : ''}`}
        acoes={pode('produtos.criar') ? <Botao onClick={() => setEd({})} icon={Plus}>Novo produto</Botao> : undefined}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs abas={[{ id: 'todos', rotulo: 'Todos' }, { id: 'deposito', rotulo: 'Em depósito' }]} ativa={aba} onChange={setAba} />
        <div className="flex-1" />
        <SearchInput valor={busca} onChange={setBusca} placeholder="Buscar plaqueta..." className="sm:w-64" />
      </div>

      {isLoading ? <SkeletonTable /> : (
        <>
          {/* Desktop */}
          <div className="hidden lg:block">
            <Tabela colunas={['Plaqueta', 'Descrição', 'Tipo', 'Tamanho', 'Contador', '']} vazio="Nenhum produto encontrado.">
              {filtrados.map((p) => (
                <tr key={p.id} className="hover:bg-papel/50 transition">
                  <td className="px-4 py-3 valor font-medium">{p.plaqueta}</td>
                  <td className="px-4 py-3">{p.descricao ?? '—'}</td>
                  <td className="px-4 py-3"><Badge var="azul">{nome(tipos, p.tipoId)}</Badge></td>
                  <td className="px-4 py-3">{nome(tamanhos, p.tamanhoId, 'descricao')}</td>
                  <td className="px-4 py-3 valor">{p.contador}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      {pode('produtos.alterar_contador') && <button onClick={() => ajustarContador(p)} title="Ajustar contador" className="text-suave hover:text-feltro transition p-1"><Gauge size={16} /></button>}
                      {pode('produtos.editar') && <button onClick={() => setEd({ ...p })} className="text-suave hover:text-feltro transition p-1"><Pencil size={16} /></button>}
                      {pode('produtos.excluir') && <button onClick={() => setExcluindo(p)} className="text-suave hover:text-alerta transition p-1"><Trash2 size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </Tabela>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden flex flex-col gap-3">
            {filtrados.length === 0 && <div className="text-center text-suave py-12">Nenhum produto encontrado.</div>}
            {filtrados.map((p) => (
              <div key={p.id} className="bg-white border border-borda rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium valor">{p.plaqueta}</span>
                  <Badge var="azul">{nome(tipos, p.tipoId)}</Badge>
                </div>
                <p className="text-suave text-sm">{p.descricao ?? '—'} • Contador: {p.contador}</p>
                <div className="flex gap-2 mt-2 justify-end">
                  {pode('produtos.editar') && <button onClick={() => setEd({ ...p })} className="text-suave hover:text-feltro p-1"><Pencil size={16} /></button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de edição */}
      <Modal aberto={!!ed} aoFechar={() => setEd(null)} titulo={ed?.id ? 'Editar produto' : 'Novo produto'}>
        {ed && (
          <div className="flex flex-col gap-3">
            <Campo label="Plaqueta" value={ed.plaqueta ?? ''} onChange={(e) => setEd({ ...ed, plaqueta: e.target.value })} />
            <Campo label="Descrição (cor)" value={ed.descricao ?? ''} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} />
            <Select label="Tipo" value={ed.tipoId ?? ''} onChange={(e) => setEd({ ...ed, tipoId: e.target.value })}>
              <option value="">Selecione…</option>
              {tipos?.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </Select>
            <Select label="Tamanho" value={ed.tamanhoId ?? ''} onChange={(e) => setEd({ ...ed, tamanhoId: e.target.value })}>
              <option value="">Selecione…</option>
              {tamanhos?.map((o) => <option key={o.id} value={o.id}>{o.descricao}</option>)}
            </Select>
            <Select label="Condição" value={ed.condicaoId ?? ''} onChange={(e) => setEd({ ...ed, condicaoId: e.target.value })}>
              <option value="">Selecione…</option>
              {condicoes?.map((o) => <option key={o.id} value={o.id}>{o.descricao}</option>)}
            </Select>
            <Campo label="Chave (opcional)" value={ed.chave ?? ''} onChange={(e) => setEd({ ...ed, chave: e.target.value })} />
            {!ed.id && <Campo label="Contador inicial" inputMode="numeric" value={ed.contador ?? ''} onChange={(e) => setEd({ ...ed, contador: e.target.value })} />}
            {erro && <p className="text-alerta text-sm">{erro}</p>}
            <div className="flex gap-2 justify-end mt-2 pt-3 border-t border-borda">
              <Botao variante="secundario" onClick={() => setEd(null)}>Cancelar</Botao>
              <Botao onClick={salvar} loading={salvando}>Salvar</Botao>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal aberto={!!excluindo} aoFechar={() => setExcluindo(null)} onConfirm={excluirProduto}
        titulo="Excluir produto" mensagem={`Excluir produto "${excluindo?.plaqueta}"?`} />
    </div>
  );
}
