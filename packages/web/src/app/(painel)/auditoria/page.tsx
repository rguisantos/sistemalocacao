'use client';
import { useState } from 'react';
import { useApi } from '@/lib/swr';
import { data as fmtData } from '@/lib/format';
import { Botao, Campo, Cartao, Tabela, Header, SearchInput, Paginacao, Select, SkeletonTable } from '@/components/ui/primitives';
import { ScrollText } from 'lucide-react';

export default function Auditoria() {
  const [pagina, setPagina] = useState(1);
  const [entidade, setEntidade] = useState('');
  const [filtro, setFiltro] = useState('');

  const q = new URLSearchParams({ pagina: String(pagina), ...(filtro && { entidade: filtro }) }).toString();
  const { data, isLoading } = useApi<{ itens: any[]; total: number; pagina: number }>(`/auditoria?${q}`);

  const itens = data?.itens ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Logs de auditoria" subtitulo="Histórico de ações no sistema" />

      <Cartao className="flex flex-wrap items-end gap-3">
        <Select label="Entidade" value={filtro} onChange={(e) => { setFiltro(e.target.value); setPagina(1); }} className="sm:w-48">
          <option value="">Todas</option>
          {['Cobranca', 'Usuario', 'Cliente', 'Produto', 'Locacao', 'Pagamento', 'Permissao'].map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </Select>
      </Cartao>

      {isLoading ? <SkeletonTable linhas={8} /> : (
        <>
          <Tabela colunas={['Quando', 'Ação', 'Entidade', 'Registro', 'IP']} vazio="Nenhum log encontrado.">
            {itens.map((l) => (
              <tr key={l.id} className="hover:bg-papel/50 transition">
                <td className="px-4 py-3 valor text-xs">{fmtData(l.criadoEm)}</td>
                <td className="px-4 py-3"><span className="font-medium">{l.acao}</span></td>
                <td className="px-4 py-3">{l.entidade}</td>
                <td className="px-4 py-3 text-suave text-xs">{l.entidadeId ?? '—'}</td>
                <td className="px-4 py-3 valor text-xs">{l.ip ?? '—'}</td>
              </tr>
            ))}
          </Tabela>
          <Paginacao pagina={pagina} total={total} limite={50} onChange={setPagina} />
        </>
      )}
    </div>
  );
}
