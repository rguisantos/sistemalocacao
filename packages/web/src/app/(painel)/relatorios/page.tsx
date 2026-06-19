'use client';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApi } from '@/lib/swr';
import { api } from '@/lib/api';
import { formatarBRL } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Botao, Cartao, Campo, Tabela, Badge, SkeletonTable, toast, Header } from '@/components/ui/primitives';
import { Calendar, Download, FileText, BarChart3 } from 'lucide-react';

const hoje = new Date().toISOString().slice(0, 10);
const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function Relatorios() {
  const { pode } = useAuth();
  const [de, setDe] = useState(inicioMes);
  const [ate, setAte] = useState(hoje);
  const [gerado, setGerado] = useState(false);

  const { data: porRota, isLoading: loadingPorRota } = useApi<any[]>(gerado ? `/relatorios/faturamento-por-rota?de=${de}&ate=${ate}` : null);
  const { data: inad, isLoading: loadingInad } = useApi<any[]>(gerado ? '/relatorios/inadimplencia' : null);

  if (!pode('relatorios.ler')) {
    return (
      <div className="flex flex-col gap-6">
        <Header titulo="Relatórios" />
        <Cartao className="text-suave text-center py-12">
          <FileText size={48} className="mx-auto mb-3 text-suave/30" />
          <p className="font-medium">Você não tem permissão para acessar relatórios.</p>
        </Cartao>
      </div>
    );
  }

  function gerar() {
    setGerado(true);
    toast('Relatório gerado com sucesso', 'sucesso');
  }

  function exportar(formato: 'pdf' | 'excel') {
    api.baixar(`/relatorios/faturamento-por-rota/exportar?de=${de}&ate=${ate}&formato=${formato}`,
      `faturamento-por-rota.${formato === 'excel' ? 'xlsx' : 'pdf'}`)
      .then(() => toast('Arquivo exportado!', 'sucesso'))
      .catch((e: any) => toast(e.message, 'erro'));
  }

  const exportButtons = pode('relatorios.exportar_pdf') ? (
    <div className="flex gap-2">
      <Botao variante="secundario" tamanho="sm" icon={Download} onClick={() => exportar('pdf')}>PDF</Botao>
      <Botao variante="secundario" tamanho="sm" icon={Download} onClick={() => exportar('excel')}>Excel</Botao>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Relatórios" subtitulo="Faturamento, inadimplência e exportações" acoes={exportButtons} />

      <Cartao className="flex flex-wrap items-end gap-3">
        <Campo label="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        <Campo label="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        <Botao onClick={gerar} icon={BarChart3}>Gerar</Botao>
      </Cartao>

      {loadingPorRota && <SkeletonTable />}
      {porRota && porRota.length > 0 && (
        <Cartao>
          <h2 className="font-display font-semibold mb-4">Faturamento por rota</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porRota.map((r: any) => ({ rota: r.rota, valor: Number(r.valor) }))}>
                <XAxis dataKey="rota" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatarBRL(v)} />
                <Bar dataKey="valor" fill="#C08A2D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
      )}

      {loadingInad && <SkeletonTable />}
      {inad && (
        <div>
          <h2 className="font-display font-semibold mb-2">Inadimplência</h2>
          <Tabela colunas={['Cliente', 'Origem', 'Valor']} vazio="Nenhuma inadimplência encontrada.">
            {(inad as any[]).map((i: any, k: number) => (
              <tr key={k}>
                <td className="px-4 py-3 font-medium">{i.cliente}</td>
                <td className="px-4 py-3 text-suave">{i.origem}</td>
                <td className="px-4 py-3 valor">{formatarBRL(i.valor)}</td>
              </tr>
            ))}
          </Tabela>
        </div>
      )}

      {!gerado && (
        <Cartao className="text-center py-12 text-suave">
          <Calendar size={48} className="mx-auto mb-3 text-suave/30" />
          <p className="font-medium">Selecione o período e clique em Gerar</p>
          <p className="text-sm mt-1">Os dados do relatório aparecerão aqui</p>
        </Cartao>
      )}
    </div>
  );
}
