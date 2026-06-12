'use client';
import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
      <h1 className="mb-6 text-2xl font-bold text-feltro">Auditoria</h1>
      <input className="mb-4 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Filtrar por ação (ex.: login, cobranca, conflito)…" value={acao} onChange={(e) => setAcao(e.target.value)} />
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-stone-50 text-left text-xs uppercase text-stone-400">
            <th className="p-3">Quando</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>IP</th>
          </tr></thead>
          <tbody>
            {logs?.map((l) => {
              const temDetalhes = l.dadosAnteriores || l.dadosNovos;
              return (
                <Fragment key={l.id}>
                  <tr className={`border-b last:border-0 ${temDetalhes ? 'cursor-pointer hover:bg-stone-50' : ''}`}
                    onClick={() => temDetalhes && setAberto(aberto === l.id ? null : l.id)}>
                    <td className="p-3 text-stone-500">{new Date(l.createdAt).toLocaleString('pt-BR')}</td>
                    <td>{l.usuario?.nome ?? 'Sistema'}</td>
                    <td className="font-medium">{l.acao}{temDetalhes && <span className="ml-1 text-xs text-stone-300">{aberto === l.id ? '▲' : '▼'}</span>}</td>
                    <td className="text-stone-500">{l.entidade}</td>
                    <td className="text-xs text-stone-400">{l.ip ?? '—'}</td>
                  </tr>
                  {aberto === l.id && (
                    <tr className="border-b bg-stone-50/60">
                      <td colSpan={5} className="p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {l.dadosAnteriores && (
                            <div>
                              <p className="mb-1 text-xs font-bold uppercase text-stone-400">Antes</p>
                              <pre className="overflow-auto rounded-lg bg-white p-2 text-xs text-stone-600">{JSON.stringify(l.dadosAnteriores, null, 2)}</pre>
                            </div>
                          )}
                          {l.dadosNovos && (
                            <div>
                              <p className="mb-1 text-xs font-bold uppercase text-stone-400">{l.dadosAnteriores ? 'Depois' : 'Dados'}</p>
                              <pre className="overflow-auto rounded-lg bg-white p-2 text-xs text-stone-600">{JSON.stringify(l.dadosNovos, null, 2)}</pre>
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
        {(logs?.length ?? 0) === 0 && <p className="p-6 text-center text-stone-400">Sem registros.</p>}
      </div>
    </div>
  );
}
