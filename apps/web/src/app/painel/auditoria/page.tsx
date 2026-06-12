'use client';
import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

interface Log {
  id: string; acao: string; entidade: string; entidadeId: string | null;
  dadosAnteriores: Record<string, unknown> | null;
  dadosNovos: Record<string, unknown> | null;
  usuario: { nome: string } | null; ip: string | null; createdAt: string;
}

export default function AuditoriaPage() {
  const [acao, setAcao] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const { data: logs } = useQuery({
    queryKey: ['auditoria', acao],
    queryFn: () => api<Log[]>(`/api/relatorios/auditoria${acao ? `?acao=${encodeURIComponent(acao)}` : ''}`),
  });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <PageHeader icone={ScrollText} titulo="Auditoria"
        descricao="Trilha completa de ações: quem fez o quê, antes e depois (retenção: 1 ano)" />
      <input className="mb-4 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Filtrar por ação (ex.: login, cobranca, conflito)…" value={acao} onChange={(e) => setAcao(e.target.value)} />
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <th className="p-3">Quando</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>IP</th>
          </tr></thead>
          <tbody>
            {logs?.map((l) => {
              const temDetalhes = l.dadosAnteriores || l.dadosNovos;
              return (
                <Fragment key={l.id}>
                  <tr className={`border-b last:border-0 ${temDetalhes ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                    onClick={() => temDetalhes && setAberto(aberto === l.id ? null : l.id)}>
                    <td className="p-3 text-muted-foreground">{new Date(l.createdAt).toLocaleString('pt-BR')}</td>
                    <td>{l.usuario?.nome ?? 'Sistema'}</td>
                    <td className="font-medium">{l.acao}{temDetalhes && <span className="ml-1 text-xs text-muted-foreground/50">{aberto === l.id ? '▲' : '▼'}</span>}</td>
                    <td className="text-muted-foreground">{l.entidade}</td>
                    <td className="text-xs text-muted-foreground">{l.ip ?? '—'}</td>
                  </tr>
                  {aberto === l.id && (
                    <tr className="border-b bg-muted/40">
                      <td colSpan={5} className="p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {l.dadosAnteriores && (
                            <div>
                              <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Antes</p>
                              <pre className="overflow-auto rounded-lg bg-card p-2 text-xs text-foreground/80">{JSON.stringify(l.dadosAnteriores, null, 2)}</pre>
                            </div>
                          )}
                          {l.dadosNovos && (
                            <div>
                              <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">{l.dadosAnteriores ? 'Depois' : 'Dados'}</p>
                              <pre className="overflow-auto rounded-lg bg-card p-2 text-xs text-foreground/80">{JSON.stringify(l.dadosNovos, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {(logs?.length ?? 0) === 0 && <p className="p-6 text-center text-muted-foreground">Sem registros.</p>}
      </div>
    </div>
  );
}
