'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Botao, Campo, Dialogo, Tabela } from '@/components/ui/primitives';

interface Catalogo { permissoes: { chave: string; descricao: string }[]; papeis: Record<string, string[]>; }

export default function Usuarios() {
  const { pode } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [rotas, setRotas] = useState<any[]>([]);
  const [cat, setCat] = useState<Catalogo>({ permissoes: [], papeis: {} });
  const [ed, setEd] = useState<any | null>(null);
  const [erro, setErro] = useState('');

  const carregar = () => {
    api.get('/usuarios').then(setUsuarios).catch(() => setUsuarios([]));
    api.get('/rotas').then(setRotas).catch(() => setRotas([]));
    api.get('/usuarios/catalogo-permissoes').then(setCat).catch(() => undefined);
  };
  useEffect(() => { carregar(); }, []);

  // agrupa permissões por módulo (prefixo antes do primeiro ponto)
  const porModulo = cat.permissoes.reduce<Record<string, { chave: string; descricao: string }[]>>((acc, p) => {
    const mod = p.chave.split('.')[0]; (acc[mod] ??= []).push(p); return acc;
  }, {});

  function abrirNovo() { setEd({ ativo: true, rotaIds: [], permissoes: [] }); }
  function abrirEdicao(u: any) {
    setEd({ id: u.id, nome: u.nome, ativo: u.ativo, version: u.version,
      rotaIds: u.rotas.map((r: any) => r.rotaId),
      permissoes: u.permissoes.map((p: any) => p.permissao.chave) });
  }
  function alternar(lista: string[], v: string) { return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]; }
  function aplicarPapel(papel: string) { setEd({ ...ed, papel, permissoes: [...(cat.papeis[papel] ?? [])] }); }

  async function salvar() {
    setErro('');
    try {
      if (ed.id) {
        await api.patch(`/usuarios/${ed.id}`, { nome: ed.nome, ativo: ed.ativo, novaSenha: ed.novaSenha || undefined, rotaIds: ed.rotaIds, version: ed.version });
        await api.patch(`/usuarios/${ed.id}/permissoes`, { permissoes: ed.permissoes });
      } else {
        await api.post('/usuarios', { nome: ed.nome, cpf: ed.cpf, senha: ed.senha, ativo: ed.ativo, rotaIds: ed.rotaIds, permissoes: ed.permissoes });
      }
      setEd(null); carregar();
    } catch (e: any) { setErro(e.message); }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Usuários</h1>
        {pode('admin.usuarios.criar') && <Botao onClick={abrirNovo}><Plus size={16} className="inline mr-1" /> Novo usuário</Botao>}
      </div>

      <Tabela colunas={['Nome', 'CPF', 'Situação', '']}>
        {usuarios.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-suave">Nenhum usuário.</td></tr>}
        {usuarios.map((u) => (
          <tr key={u.id}>
            <td className="px-4 py-3">{u.nome}</td>
            <td className="px-4 py-3 valor">{u.cpf}</td>
            <td className="px-4 py-3">{u.ativo ? 'Ativo' : 'Inativo'}</td>
            <td className="px-4 py-3 text-right">
              {pode('admin.usuarios.editar') && <button onClick={() => abrirEdicao(u)} className="text-suave hover:text-feltro"><Pencil size={16} /></button>}
            </td>
          </tr>
        ))}
      </Tabela>

      <Dialogo aberto={!!ed} aoFechar={() => setEd(null)} titulo={ed?.id ? 'Editar usuário' : 'Novo usuário'}>
        {ed && (
          <div className="flex flex-col gap-3 max-h-[70vh] overflow-auto">
            <Campo label="Nome" value={ed.nome ?? ''} onChange={(e) => setEd({ ...ed, nome: e.target.value })} />
            {!ed.id && <Campo label="CPF" value={ed.cpf ?? ''} onChange={(e) => setEd({ ...ed, cpf: e.target.value })} />}
            <Campo label={ed.id ? 'Nova senha (opcional)' : 'Senha'} type="password" value={ed.id ? (ed.novaSenha ?? '') : (ed.senha ?? '')}
              onChange={(e) => setEd(ed.id ? { ...ed, novaSenha: e.target.value } : { ...ed, senha: e.target.value })} />

            <div className="text-sm">
              <p className="text-suave font-medium mb-1">Rotas</p>
              <div className="flex flex-wrap gap-2">
                {rotas.map((r) => (
                  <button key={r.id} onClick={() => setEd({ ...ed, rotaIds: alternar(ed.rotaIds, r.id) })}
                    className={`px-3 py-1 rounded-xl border ${ed.rotaIds.includes(r.id) ? 'bg-feltro text-papel border-feltro' : 'border-borda'}`}>{r.nome}</button>
                ))}
              </div>
            </div>

            <div className="text-sm">
              <p className="text-suave font-medium mb-1">Papel (preenche permissões)</p>
              <div className="flex gap-2">
                {Object.keys(cat.papeis).map((p) => (
                  <button key={p} onClick={() => aplicarPapel(p)} className={`px-3 py-1 rounded-xl border ${ed.papel === p ? 'bg-latao text-white border-latao' : 'border-borda'}`}>{p}</button>
                ))}
              </div>
            </div>

            <div className="text-sm">
              <p className="text-suave font-medium mb-1">Permissões</p>
              {Object.entries(porModulo).map(([mod, perms]) => (
                <details key={mod} className="border border-borda rounded-xl mb-2">
                  <summary className="px-3 py-2 cursor-pointer font-medium capitalize">{mod}</summary>
                  <div className="px-3 pb-2 grid grid-cols-1 gap-1">
                    {perms.map((p) => (
                      <label key={p.chave} className="flex items-center gap-2">
                        <input type="checkbox" checked={ed.permissoes.includes(p.chave)} onChange={() => setEd({ ...ed, permissoes: alternar(ed.permissoes, p.chave) })} />
                        <span>{p.descricao}</span>
                      </label>
                    ))}
                  </div>
                </details>
              ))}
            </div>

            {erro && <p className="text-alerta text-sm">{erro}</p>}
            <div className="flex gap-2 justify-end mt-2 sticky bottom-0 bg-white pt-2">
              <Botao variante="secundario" onClick={() => setEd(null)}>Cancelar</Botao>
              <Botao onClick={salvar}>Salvar</Botao>
            </div>
          </div>
        )}
      </Dialogo>
    </div>
  );
}
