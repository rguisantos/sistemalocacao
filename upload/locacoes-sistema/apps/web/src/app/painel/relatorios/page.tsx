'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { api, apiBlob } from '@/lib/api';
import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/store/auth';
import { formatarBRL, PERMISSOES } from '@locacoes/shared';

interface Linha { chave: string; qtd: number; valor_devido: string; valor_recebido: string }
interface Resposta { dimensao: string; rotulo: string; linhas: Linha[] }
interface Rota { id: string; nome: string }

// Presets = relatórios pré-definidos do spec, todos servidos pelo
// endpoint flexível (dimensão × métricas)
const PRESETS = [
  ['rota', 'Por rota (comparativo)'],
  ['cobrador', 'Por cobrador'],
  ['cliente', 'Por cliente'],
  ['produto', 'Produtos mais lucrativos'],
  ['forma_pagamento', 'Por forma de pagamento'],
  ['mes', 'Evolução mensal'],
] as const;

const NOME_FORMA: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX_MANUAL: 'PIX manual', CARTAO: 'Cartão', PIX_MERCADO_PAGO: 'PIX QR Code',
};

function primeiroDiaDoMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
const hoje = () => new Date().toISOString().slice(0, 10);

export default function RelatoriosPage() {
  const { temPermissao } = useAuth();
  const [dimensao, setDimensao] = useState<string>('rota');
  const [inicio, setInicio] = useState(primeiroDiaDoMes());
  const [fim, setFim] = useState(hoje());
  const [rotaId, setRotaId] = useState('');

  const { data: rotas } = useQuery({ queryKey: ['rotas'], queryFn: () => api<Rota[]>('/api/rotas') });
  const { data, isFetching } = useQuery({
    queryKey: ['flexivel', dimensao, inicio, fim, rotaId],
    queryFn: () =>
      api<Resposta>(
        `/api/relatorios/flexivel?dimensao=${dimensao}&inicio=${inicio}T00:00:00&fim=${fim}T23:59:59${rotaId ? `&rotaId=${rotaId}` : ''}`
      ),
    enabled: !!inicio && !!fim,
  });

  const linhas = data?.linhas ?? [];
  const totais = linhas.reduce(
    (a, l) => ({
      qtd: a.qtd + Number(l.qtd),
      devido: a.devido + Number(l.valor_devido),
      recebido: a.recebido + Number(l.valor_recebido),
    }),
    { qtd: 0, devido: 0, recebido: 0 }
  );

  const rotuloChave = (chave: string) =>
    dimensao === 'forma_pagamento' ? (NOME_FORMA[chave] ?? chave) : chave;

  function dadosTabulares() {
    return linhas.map((l) => ({
      [data?.rotulo ?? 'Chave']: rotuloChave(l.chave),
      'Cobranças': Number(l.qtd),
      'Valor devido': Number(l.valor_devido),
      'Valor recebido': Number(l.valor_recebido),
      'Eficiência %': Number(l.valor_devido) > 0
        ? Math.round((Number(l.valor_recebido) / Number(l.valor_devido)) * 100)
        : 100,
    }));
  }

  function exportarXLSX() {
    const ws = XLSX.utils.json_to_sheet(dadosTabulares());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `relatorio_${dimensao}_${inicio}_a_${fim}.xlsx`);
  }

  async function baixarPDF() {
    try {
      const blob = await apiBlob(
        `/api/relatorios/flexivel.pdf?dimensao=${dimensao}&inicio=${inicio}T00:00:00&fim=${fim}T23:59:59${rotaId ? `&rotaId=${rotaId}` : ''}`
      );
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `relatorio_${dimensao}_${inicio}_a_${fim}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function exportarCSV() {
    const dados = dadosTabulares();
    if (!dados.length) return;
    const cab = Object.keys(dados[0]).join(';');
    const corpo = dados.map((d) => Object.values(d).map((v) => String(v).replace('.', ',')).join(';'));
    const blob = new Blob(['\uFEFF' + [cab, ...corpo].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio_${dimensao}_${inicio}_a_${fim}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="print:hidden">
        <PageHeader icone={BarChart3} titulo="Relatórios"
          descricao="Faturamento por dimensão com exportação CSV, Excel e PDF" />
      </div>
      <h1 className="mb-2 hidden text-2xl font-bold print:block">Relatórios</h1>

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {PRESETS.map(([v, r]) => (
          <button key={v} onClick={() => setDimensao(v)}
            className={`rounded-full border px-4 py-1.5 text-sm ${dimensao === v ? 'border-feltro bg-feltro text-white' : 'border-border bg-card'}`}>
            {r}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Início</label>
          <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Fim</label>
          <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Rota</label>
          <select className="rounded-lg border px-3 py-2 text-sm" value={rotaId} onChange={(e) => setRotaId(e.target.value)}>
            <option value="">Todas</option>
            {rotas?.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
        <button onClick={exportarCSV} disabled={!linhas.length}
          className="rounded-lg border border-feltro px-4 py-2 text-sm font-semibold text-feltro disabled:opacity-40">
          CSV
        </button>
        {temPermissao(PERMISSOES.EXPORTAR_RELATORIOS_EXCEL) && (
          <button onClick={exportarXLSX} disabled={!linhas.length}
            className="rounded-lg border border-feltro px-4 py-2 text-sm font-semibold text-feltro disabled:opacity-40">
            Excel (.xlsx)
          </button>
        )}
        {temPermissao(PERMISSOES.EXPORTAR_RELATORIOS_PDF) && (
          <>
            <button onClick={baixarPDF} disabled={!linhas.length}
              className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              Baixar PDF
            </button>
            <button onClick={() => window.print()} disabled={!linhas.length}
              className="rounded-lg border border-feltro px-4 py-2 text-sm font-semibold text-feltro disabled:opacity-40">
              Imprimir
            </button>
          </>
        )}
      </div>

      <p className="mb-3 hidden text-sm text-muted-foreground print:block">
        {PRESETS.find(([v]) => v === dimensao)?.[1]} · {new Date(inicio).toLocaleDateString('pt-BR')} a{' '}
        {new Date(fim).toLocaleDateString('pt-BR')}
        {rotaId && rotas ? ` · Rota: ${rotas.find((r) => r.id === rotaId)?.nome}` : ''}
      </p>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm print:shadow-none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground print:bg-card">
              <th className="p-3">{data?.rotulo ?? '—'}</th>
              <th className="text-right">Cobranças</th>
              <th className="text-right">Valor devido</th>
              <th className="text-right">Valor recebido</th>
              <th className="p-3 text-right">Eficiência</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const ef = Number(l.valor_devido) > 0 ? (Number(l.valor_recebido) / Number(l.valor_devido)) * 100 : 100;
              return (
                <tr key={l.chave} className="border-b last:border-0">
                  <td className="p-3 font-medium">{rotuloChave(l.chave)}</td>
                  <td className="text-right">{l.qtd}</td>
                  <td className="text-right">{formatarBRL(l.valor_devido)}</td>
                  <td className="text-right font-semibold">{formatarBRL(l.valor_recebido)}</td>
                  <td className="p-3 text-right">{ef.toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
          {linhas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold">
                <td className="p-3">Total</td>
                <td className="text-right">{totais.qtd}</td>
                <td className="text-right">{formatarBRL(totais.devido)}</td>
                <td className="text-right">{formatarBRL(totais.recebido)}</td>
                <td className="p-3 text-right">
                  {totais.devido > 0 ? ((totais.recebido / totais.devido) * 100).toFixed(0) : 100}%
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        {isFetching && <p className="p-4 text-center text-muted-foreground">Carregando…</p>}
        {!isFetching && linhas.length === 0 && (
          <EmptyState icone={BarChart3} titulo="Sem cobranças no período"
            descricao="Ajuste o intervalo de datas ou o filtro de rota para visualizar resultados." />
        )}
      </div>
    </div>
  );
}
