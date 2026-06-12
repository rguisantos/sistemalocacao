// apps/web/src/app/painel/conflitos/page.tsx
'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { GitMerge, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

interface Conflito {
  id: string;
  entidade: string;
  entidadeId: string;
  dadosMobile: Record<string, unknown>;
  dadosServidor: Record<string, unknown>;
  camposConflitantes: string[];
  deviceId: string | null;
  createdAt: string;
}

const NOME_ENTIDADE: Record<string, string> = {
  clientes: 'Cliente',
  enderecos: 'Endereço',
  locacoes: 'Locação',
};

function valorLegivel(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v);
}

function CartaoConflito({ conflito }: { conflito: Conflito }) {
  const qc = useQueryClient();
  // escolha por campo: 'servidor' | 'mobile'
  const [escolhas, setEscolhas] = useState<Record<string, 'servidor' | 'mobile'>>(
    Object.fromEntries(conflito.camposConflitantes.map((c) => [c, 'servidor']))
  );
  const [erro, setErro] = useState('');

  const resolver = useMutation({
    mutationFn: (body: { resolucao: string; camposMesclados?: Record<string, unknown> }) =>
      api(`/api/conflitos/${conflito.id}/resolver`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conflitos'] });
      qc.invalidateQueries({ queryKey: ['conflitos-stats'] });
    },
    onError: (e: Error) => setErro(e.message),
  });

  const temEscolhaMobile = Object.values(escolhas).some((v) => v === 'mobile');
  const todasMobile = Object.values(escolhas).every((v) => v === 'mobile');

  function confirmarMesclagem() {
    if (todasMobile) {
      resolver.mutate({ resolucao: 'aplicar_mobile' });
    } else if (!temEscolhaMobile) {
      resolver.mutate({ resolucao: 'manter_servidor' });
    } else {
      const camposMesclados: Record<string, unknown> = {};
      for (const [campo, origem] of Object.entries(escolhas)) {
        if (origem === 'mobile') camposMesclados[campo] = conflito.dadosMobile[campo];
      }
      resolver.mutate({ resolucao: 'mesclar', camposMesclados });
    }
  }

  return (
    <div className="mb-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="rounded-md bg-feltro/10 px-2 py-1 text-xs font-bold text-feltro">
            {NOME_ENTIDADE[conflito.entidade] ?? conflito.entidade}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            {new Date(conflito.createdAt).toLocaleString('pt-BR')}
            {conflito.deviceId ? ` · aparelho ${conflito.deviceId.slice(0, 8)}` : ''}
          </span>
        </div>
        <code className="text-xs text-muted-foreground">{conflito.entidadeId.slice(0, 12)}…</code>
      </div>

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2">Campo</th>
            <th>Valor no servidor</th>
            <th>Valor no aparelho</th>
            <th className="text-center">Usar</th>
          </tr>
        </thead>
        <tbody>
          {conflito.camposConflitantes.map((campo) => (
            <tr key={campo} className="border-b last:border-0">
              <td className="py-2 font-medium">{campo}</td>
              <td className={escolhas[campo] === 'servidor' ? 'font-semibold text-feltro' : 'text-muted-foreground'}>
                {valorLegivel(conflito.dadosServidor[campo])}
              </td>
              <td className={escolhas[campo] === 'mobile' ? 'font-semibold text-feltro' : 'text-muted-foreground'}>
                {valorLegivel(conflito.dadosMobile[campo])}
              </td>
              <td className="text-center">
                <div className="inline-flex overflow-hidden rounded-lg border border-border text-xs">
                  {(['servidor', 'mobile'] as const).map((origem) => (
                    <button
                      key={origem}
                      onClick={() => setEscolhas((e) => ({ ...e, [campo]: origem }))}
                      className={`px-3 py-1.5 transition ${
                        escolhas[campo] === origem
                          ? 'bg-feltro text-white'
                          : 'bg-card text-foreground/80 hover:bg-muted/50'
                      }`}
                    >
                      {origem === 'servidor' ? 'Servidor' : 'Aparelho'}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {erro && <p className="mb-2 text-sm text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <button
          onClick={confirmarMesclagem}
          disabled={resolver.isPending}
          className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white hover:bg-feltro-claro disabled:opacity-50"
        >
          {resolver.isPending
            ? 'Aplicando…'
            : todasMobile
              ? 'Aplicar versão do aparelho'
              : temEscolhaMobile
                ? 'Aplicar mesclagem'
                : 'Manter versão do servidor'}
        </button>
        <button
          onClick={() => resolver.mutate({ resolucao: 'manter_servidor' })}
          disabled={resolver.isPending}
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground/80 hover:bg-muted/50 disabled:opacity-50"
        >
          Descartar alterações do aparelho
        </button>
      </div>
    </div>
  );
}

export default function ConflitosPage() {
  const { data: conflitos, isLoading } = useQuery({
    queryKey: ['conflitos'],
    queryFn: () => api<Conflito[]>('/api/conflitos?resolvido=false'),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['conflitos-stats'],
    queryFn: () =>
      api<{ pendentes: number; autoResolvidos: number }>('/api/conflitos/estatisticas'),
  });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <PageHeader icone={GitMerge} titulo="Conflitos de Sincronização"
        descricao="Divergências em campos críticos aguardando decisão manual" />
      {stats && stats.autoResolvidos > 0 && (
        <p className="-mt-3 mb-4 text-xs text-muted-foreground">
          {stats.autoResolvidos} conflito(s) resolvidos automaticamente (fast-forward, dados idênticos ou mesclagem segura).
        </p>
      )}

      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {!isLoading && (conflitos?.length ?? 0) === 0 && (
        <div className="rounded-xl border bg-card p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-feltro">Tudo sincronizado ✓</p>
          <p className="text-sm text-muted-foreground">Nenhum conflito pendente de resolução.</p>
        </div>
      )}
      {conflitos?.map((c) => <CartaoConflito key={c.id} conflito={c} />)}
    </div>
  );
}
