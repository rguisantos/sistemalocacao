'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { UserCog, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MiniStat } from '@/components/ui/MiniStat';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';

interface Usuario { id: string; nome: string; cpf: string; ativo: boolean; permissoes: string[]; rotas: { id: string; nome: string }[] }
interface Permissao { id: string; chave: string; descricao: string; grupo: string }
interface Rota { id: string; nome: string }

export default function UsuariosPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState({ nome: '', cpf: '', senha: '', permissoes: [] as string[], rotaIds: [] as string[] });
  const [erro, setErro] = useState('');

  const { data: usuarios } = useQuery({ queryKey: ['usuarios'], queryFn: () => api<Usuario[]>('/api/usuarios') });
  const { data: permissoes } = useQuery({ queryKey: ['permissoes'], queryFn: () => api<Permissao[]>('/api/usuarios/permissoes') });
  const { data: rotas } = useQuery({ queryKey: ['rotas'], queryFn: () => api<Rota[]>('/api/rotas') });

  const grupos = [...new Set(permissoes?.map((p) => p.grupo) ?? [])];

  const criar = useMutation({
    mutationFn: () => api('/api/usuarios', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => { setNovo(false); setForm({ nome: '', cpf: '', senha: '', permissoes: [], rotaIds: [] }); qc.invalidateQueries({ queryKey: ['usuarios'] }); toast({ titulo: 'Usuário criado' }); },
    onError: (e: Error) => setErro(e.message),
  });

  const alternar = (lista: string[], v: string) => lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];

  const atualizarUsuario = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/api/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast({ titulo: 'Usuário atualizado' }); },
    onError: (e: Error) => setErro(e.message),
  });

  const [editandoPerm, setEditandoPerm] = useState<Usuario | null>(null);
  const [permEdit, setPermEdit] = useState<string[]>([]);
  const [rotasEdit, setRotasEdit] = useState<string[]>([]);

  function abrirPermissoes(u: Usuario) {
    setErro('');
    setEditandoPerm(u);
    setPermEdit([...u.permissoes]);
    setRotasEdit(u.rotas.map((r) => r.id));
  }

  const salvarPermissoes = useMutation({
    mutationFn: () =>
      api(`/api/usuarios/${editandoPerm!.id}`, {
        method: 'PUT',
        body: JSON.stringify({ permissoes: permEdit, rotaIds: rotasEdit }),
      }),
    onSuccess: () => { setEditandoPerm(null); qc.invalidateQueries({ queryKey: ['usuarios'] }); toast({ titulo: 'Permissões atualizadas' }); },
    onError: (e: Error) => setErro(e.message),
  });

  function resetarSenha(u: Usuario) {
    const senha = window.prompt(`Nova senha para ${u.nome} (mín. 6 caracteres):`);
    if (!senha) return;
    if (senha.length < 6) { setErro('Senha muito curta'); return; }
    atualizarUsuario.mutate({ id: u.id, body: { senha } });
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <PageHeader icone={UserCog} titulo="Usuários"
        descricao="Acessos, permissões granulares e rotas atribuídas">
        <button onClick={() => setNovo(!novo)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> {novo ? 'Cancelar' : 'Novo Usuário'}
        </button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <MiniStat rotulo="Total" valor={usuarios?.length ?? 0} />
        <MiniStat rotulo="Ativos" valor={(usuarios ?? []).filter((u) => u.ativo).length} cor="text-primary" />
        <MiniStat rotulo="Inativos" valor={(usuarios ?? []).filter((u) => !u.ativo).length}
          cor={(usuarios ?? []).some((u) => !u.ativo) ? 'text-destructive' : 'text-muted-foreground'} />
      </div>

      {novo && (
        <div className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <input className="rounded-lg border px-3 py-2" placeholder="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <input className="rounded-lg border px-3 py-2" placeholder="CPF (11 dígitos) *" maxLength={11} value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value.replace(/\D/g, '') })} />
            <input className="rounded-lg border px-3 py-2" type="password" placeholder="Senha (≥6) *" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
          </div>
          <p className="mb-2 text-sm font-semibold">Rotas atribuídas</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {rotas?.map((r) => (
              <button key={r.id} onClick={() => setForm({ ...form, rotaIds: alternar(form.rotaIds, r.id) })}
                className={`rounded-full border px-3 py-1 text-xs ${form.rotaIds.includes(r.id) ? 'border-feltro bg-feltro text-white' : 'border-border'}`}>
                {r.nome}
              </button>
            ))}
          </div>
          <p className="mb-2 text-sm font-semibold">Permissões</p>
          {grupos.map((g) => (
            <div key={g} className="mb-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{g}</p>
              <div className="flex flex-wrap gap-2">
                {permissoes?.filter((p) => p.grupo === g).map((p) => (
                  <button key={p.chave} title={p.descricao}
                    onClick={() => setForm({ ...form, permissoes: alternar(form.permissoes, p.chave) })}
                    className={`rounded-full border px-3 py-1 text-xs ${form.permissoes.includes(p.chave) ? 'border-feltro bg-feltro text-white' : 'border-border'}`}>
                    {p.chave}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {erro && <p className="mb-2 text-sm text-destructive">{erro}</p>}
          <button onClick={() => criar.mutate()} disabled={criar.isPending}
            className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Salvar usuário
          </button>
        </div>
      )}

      {editandoPerm && (
        <div className="mb-6 rounded-xl border-2 border-primary/30 bg-card p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-feltro">
            Permissões de {editandoPerm.nome}
            <span className="ml-2 font-normal text-amber-600">(salvar revoga as sessões ativas do usuário)</span>
          </p>
          <p className="mb-2 text-sm font-semibold">Rotas</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {rotas?.map((r) => (
              <button key={r.id} onClick={() => setRotasEdit(alternar(rotasEdit, r.id))}
                className={`rounded-full border px-3 py-1 text-xs ${rotasEdit.includes(r.id) ? 'border-feltro bg-feltro text-white' : 'border-border'}`}>
                {r.nome}
              </button>
            ))}
          </div>
          {grupos.map((g) => (
            <div key={g} className="mb-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{g}</p>
              <div className="flex flex-wrap gap-2">
                {permissoes?.filter((p) => p.grupo === g).map((p) => (
                  <button key={p.chave} title={p.descricao}
                    onClick={() => setPermEdit(alternar(permEdit, p.chave))}
                    className={`rounded-full border px-3 py-1 text-xs ${permEdit.includes(p.chave) ? 'border-feltro bg-feltro text-white' : 'border-border'}`}>
                    {p.chave}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={() => salvarPermissoes.mutate()} disabled={salvarPermissoes.isPending}
              className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Salvar permissões
            </button>
            <button onClick={() => setEditandoPerm(null)} className="rounded-lg border px-4 py-2 text-sm text-muted-foreground">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && !novo && <p className="mb-3 text-sm text-destructive">{erro}</p>}
      <p className="mb-2 text-xs text-muted-foreground">
        Desativar ou trocar a senha de um usuário revoga todas as sessões dele imediatamente.
      </p>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <th className="p-3">Usuário</th><th>Rotas</th><th>Permissões</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {usuarios?.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar nome={u.nome} />
                    <div>
                      <p className="font-medium">{u.nome}</p>
                      <p className="text-xs text-muted-foreground">{u.cpf}</p>
                    </div>
                  </div>
                </td>
                <td className="text-xs">{u.rotas.map((r) => r.nome).join(', ') || '—'}</td>
                <td><Badge variante="outline">{u.permissoes.length} permissões</Badge></td>
                <td>{u.ativo ? <Badge variante="success">Ativo</Badge> : <Badge variante="destructive">Inativo</Badge>}</td>
                <td className="pr-3 text-right text-xs whitespace-nowrap">
                  <button className="text-muted-foreground hover:text-feltro"
                    onClick={() => atualizarUsuario.mutate({ id: u.id, body: { ativo: !u.ativo } })}>
                    {u.ativo ? 'desativar' : 'ativar'}
                  </button>
                  <span className="mx-1 text-muted-foreground/50">·</span>
                  <button className="text-muted-foreground hover:text-feltro" onClick={() => resetarSenha(u)}>
                    resetar senha
                  </button>
                  <span className="mx-1 text-muted-foreground/50">·</span>
                  <button className="text-muted-foreground hover:text-feltro" onClick={() => abrirPermissoes(u)}>
                    permissões
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
