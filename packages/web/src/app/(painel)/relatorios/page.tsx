'use client';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';
import { formatarBRL } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Botao, Cartao, Campo, Tabela } from '@/components/ui/primitives';

const hoje = new Date().toISOString().slice(0, 10);
const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function Relatorios() {
  const { pode } = useAuth();
  const [de, setDe] = useState(inicioMes); const [ate, setAte] = useState(hoje);
  const [porRota, setPorRota] = useState<any[]>([]);
  const [inad, setInad] = useState<any[]>([]);
  const [erro, setErro] = useState('');

  if (!pode('relatorios.ler')) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-bold">Relatórios</h1>
        <Cartao className="text-suave">Você não tem permissão para acessar relatórios.</Cartao>
      </div>
    );
  }

  async function gerar() {
    setErro('');
    try {
      setPorRota(await api.get(`/relatorios/faturamento-por-rota?de=${de}&ate=${ate}`));
      setInad(await api.get('/relatorios/inadimplencia'));
    } catch (e: any) { setErro(e.message); }
  }
  const exportar = (formato: 'pdf' | 'excel') =>
    api.baixar(`/relatorios/faturamento-por-rota/exportar?de=${de}&ate=${ate}&formato=${formato}`,
      `faturamento-por-rota.${formato === 'excel' ? 'xlsx' : 'pdf'}`).catch((e: any) => setErro(e.message));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Relatórios</h1>

      <Cartao className="flex flex-wrap items-end gap-3">
        <Campo label="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        <Campo label="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        <Botao onClick={gerar}>Gerar</Botao>
        {pode('relatorios.exportar_pdf') && <>
          <Botao variante="secundario" onClick={() => exportar('pdf')}>Exportar PDF</Botao>
          <Botao variante="secundario" onClick={() => exportar('excel')}>Exportar Excel</Botao>
        </>}
      </Cartao>
      {erro && <p className="text-alerta text-sm">{erro}</p>}

      {porRota.length > 0 && (
        <Cartao>
          <h2 className="font-display font-semibold mb-4">Faturamento por rota</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porRota.map((r) => ({ rota: r.rota, valor: Number(r.valor) }))}>
                <XAxis dataKey="rota" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatarBRL(v)} />
                <Bar dataKey="valor" fill="#C08A2D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
      )}

      <div>
        <h2 className="font-display font-semibold mb-2">Inadimplência</h2>
        <Tabela colunas={['Cliente', 'Origem', 'Valor']}>
          {inad.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-suave">Gere o relatório para ver os dados.</td></tr>}
          {inad.map((i, k) => (
            <tr key={k}><td className="px-4 py-3">{i.cliente}</td><td className="px-4 py-3 text-suave">{i.origem}</td><td className="px-4 py-3 valor">{formatarBRL(i.valor)}</td></tr>
          ))}
        </Tabela>
      </div>
    </div>
  );
}
