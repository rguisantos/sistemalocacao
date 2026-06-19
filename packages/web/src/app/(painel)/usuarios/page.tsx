'use client';
import { useState } from 'react';
import { Plus, Pencil, UserCog } from 'lucide-react';
import { useApi, useApiMutation, revalidar } from '@/lib/swr';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { mascararCpf } from '@/lib/masks';
import { Botao, Campo, Checkbox, Modal, Tabela, Badge, Header, SearchInput, SkeletonTable, toast } from '@/components/ui/primitives';

interface Catalogo { permissoes: { chave: string; descricao: string }[]; papeis: Record<string, string[]>; }

export default function Usuarios() {
  const { pode } = useAuth();
  const [busca, setBusca] = useState('');
  const [ed, setEd] = useState<any | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { data: usuarios, isLoading } = useApi<any[]>('/usuarios');
  const { data: rotas } = useApi<any[]>('/rotas');
  const { data: cat } = useApi<Catalogo>('/usuarios/catalogo-permissoes');

  const porModulo = (cat?.permissoes ?? []).reduce<Record<string, { chave: string; descricao: string }[]>>((acc, p) => {
    const mod = p.chave.split('.')[0]; (acc[mod] ??= []).push(p); return acc;
  }, {});

  const filtrados = (usuarios ?? []).filter((u) => {
    if (busca && !u.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  function abrirNovo() { setEd({ ativo: true, rotaIds: [], permissoes: [] }); }
  function abrirEdicao(u: any) {
    setEd({ id: u.id, nome: u.nome, ativo: u.ativo, version: u.version,
      rotaIds: u.rotas.map((r: any) => r.rotaId),
      permissoes: u.permissoes.map((p: any) => p.permissao.chave) });
  }
  function alternar(lista: string[], v: string) { return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]; }
  function aplicarPapel(papel: string) { setEd({ ...ed, papel, permissoes: [...(cat?.papeis[papel] ?? [])] }); }

  async function salvar() {
    setErro(''); setSalvando(true);
    try {
      if (ed.id) {
        await api.patch(`/usuarios/${ed.id}`, { nome: ed.nome, ativo: ed.ativo, novaSenha: ed.novaSenha || undefined, rotaIds: ed.rotaIds, version: ed.version });
        await api.patch(`/usuarios/${ed.id}/permissoes`, { permissoes: ed.permissoes });
      } else {
        await api.post('/usuarios', { nome: ed.nome, cpf: ed.cpf, senha: ed.senha, ativo: ed.ativo, rotaIds: ed.rotaIds, permissoes: ed.permissoes });
      }
      toast(ed.id ? 'Usuário atualizado!' : 'Usuário criado!', 'sucesso');
      setEd(null); revalidar('/usuarios');
    } catch (e: any) { setErro(e.message); toast(e.message, 'erro'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Usuários" subtitulo={`${filtrados.length} usuário${filtrados.length !== 1 ? 's' : ''}`}
        acoes={pode('admin.usuarios.criar') ? <Botao onClick={abrirNovo} icon={Plus}>Novo usuário</Botao> : undefined}
      />

      <SearchInput valor={busca} onChange={setBusca} placeholder="Buscar por nome..." className="sm:w-72" />

      {isLoading ? <SkeletonTable /> : (
        <Tabela colunas={['Nome', 'CPF', 'Situação', 'Permissões', '']} vazio="Nenhum usuário.">
          {filtrados.map((u) => (
            <tr key={u.id} className="hover:bg-papel/50 transition">
              <td className="px-4 py-3 font-medium">{u.nome}</td>
              <td className="px-4 py-3 valor">{mascararCpf(u.cpf || '')}</td>
              <td className="px-4 py-3"><Badge var={u.ativo ? 'verde' : 'cinza'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {u.permissoes.slice(0, 3).map((p: any) => <Badge key={p.permissao.chave} var="azul">{p.permissao.chave.split('.').pop()}</Badge>)}
                  {u.permissoes.length > 3 && <Badge var="cinza">+{u.permissoes.length - 3}</Badge>}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                {pode('admin.usuarios.editar') && <button onClick={() => abrirEdicao(u)} className="text-suave hover:text-feltro transition p-1"><Pencil size={16} /></button>}
              </td>
            </tr>
          ))}
        </Tabela>
      )}

      <Modal aberto={!!ed} aoFechar={() => setEd(null)} titulo={ed?.id ? 'Editar usuário' : 'Novo usuário'} tamanho="lg">
        {ed && (
          <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
            <Campo label="Nome" value={ed.nome ?? ''} onChange={(e) => setEd({ ...ed, nome: e.target.value })} />
            {!ed.id && <Campo label="CPF" value={ed.cpf ?? ''} onChange={(e) => setEd({ ...ed, cpf: e.target.value.replace(/\D/g, '') })} />}
            <Campo label={ed.id ? 'Nova senha (opcional)' : 'Senha'} type="password"
              value={ed.id ? (ed.novaSenha ?? '') : (ed.senha ?? '')}
              onChange={(e) => setEd(ed.id ? { ...ed, novaSenha: e.target.value } : { ...ed, senha: e.target.value })} />

            <div className="text-sm border-t border-borda pt-3">
              <p className="text-suave font-medium mb-2">Rotas</p>
              <div className="flex flex-wrap gap-2">
                {(rotas ?? []).map((r: any) => (
                  <button key={r.id} onClick={() => setEd({ ...ed, rotaIds: alternar(ed.rotaIds, r.id) })}
                    className={`px-3 py-1.5 rounded-xl border text-sm transition ${ed.rotaIds.includes(r.id) ? 'bg-feltro text-papel border-feltro' : 'border-borda hover:bg-papel'}`}>{r.nome}</button>
                ))}
              </div>
            </div>

            <div className="text-sm border-t border-borda pt-3">
              <p className="text-suave font-medium mb-2">Papel (preenche permissões)</p>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(cat?.papeis ?? {}).map((p) => (
                  <button key={p} onClick={() => aplicarPapel(p)}
                    className={`px-3 py-1.5 rounded-xl border text-sm transition ${ed.papel === p ? 'bg-latao text-white border-latao' : 'border-borda hover:bg-papel'}`}>{p}</button>
                ))}
              </div>
            </div>

            <div className="text-sm border-t border-borda pt-3">
              <p className="text-suave font-medium mb-2">Permissões</p>
              {Object.entries(porModulo).map(([mod, perms]) => (
                <details key={mod} className="border border-borda rounded-xl mb-2">
                  <summary className="px-3 py-2 cursor-pointer font-medium capitalize hover:bg-papel transition">{mod}</summary>
                  <div className="px-3 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {perms.map((p) => (
                      <Checkbox key={p.chave} label={p.descricao} checked={ed.permissoes.includes(p.chave)}
                        onChange={() => setEd({ ...ed, permissoes: alternar(ed.permissoes, p.chave) })} />
                    ))}
                  </div>
                </details>
              ))}
            </div>

            {erro && <p className="text-alerta text-sm">{erro}</p>}
            <div className="flex gap-2 justify-end mt-2 pt-3 border-t border-borda">
              <Botao variante="secundario" onClick={() => setEd(null)}>Cancelar</Botao>
              <Botao onClick={salvar} loading={salvando}>Salvar</Botao>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
