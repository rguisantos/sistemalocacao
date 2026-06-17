'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { data as fmtData } from '@/lib/format';
import { Botao, Campo, Cartao, Tabela } from '@/components/ui/primitives';

export default function Auditoria() {
  const [itens, setItens] = useState<any[]>([]);
  const [total, setTotal] = useState(0); const [pagina, setPagina] = useState(1);
  const [entidade, setEntidade] = useState(''); const [erro, setErro] = useState('');

  async function carregar(p = pagina) {
    setErro('');
    try {
      const q = new URLSearchParams({ pagina: String(p), ...(entidade && { entidade }) });
      const r = await api.get(`/auditoria?${q.toString()}`);
      setItens(r.itens); setTotal(r.total); setPagina(r.pagina);
    } catch (e: any) { setErro(e.message); }
  }
  useEffect(() => { carregar(1); }, []);
  const totalPaginas = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Logs de auditoria</h1>
      <Cartao className="flex flex-wrap items-end gap-3">
        <Campo label="Entidade (ex.: Cobranca, Usuario)" value={entidade} onChange={(e) => setEntidade(e.target.value)} />
        <Botao onClick={() => carregar(1)}>Filtrar</Botao>
      </Cartao>
      {erro && <p className="text-alerta text-sm">{erro}</p>}

      <Tabela colunas={['Quando', 'Ação', 'Entidade', 'Registro', 'IP']}>
        {itens.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-suave">Nenhum log no filtro atual.</td></tr>}
        {itens.map((l) => (
          <tr key={l.id}>
            <td className="px-4 py-3 valor">{fmtData(l.criadoEm)}</td>
            <td className="px-4 py-3">{l.acao}</td>
            <td className="px-4 py-3">{l.entidade}</td>
            <td className="px-4 py-3 text-suave">{l.entidadeId ?? '—'}</td>
            <td className="px-4 py-3 valor">{l.ip ?? '—'}</td>
          </tr>
        ))}
      </Tabela>

      <div className="flex items-center gap-3 text-sm">
        <Botao variante="secundario" disabled={pagina <= 1} onClick={() => carregar(pagina - 1)}>Anterior</Botao>
        <span className="text-suave">Página {pagina} de {totalPaginas} ({total} registros)</span>
        <Botao variante="secundario" disabled={pagina >= totalPaginas} onClick={() => carregar(pagina + 1)}>Próxima</Botao>
      </div>
    </div>
  );
}
