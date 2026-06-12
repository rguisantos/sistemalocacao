// apps/web/src/app/painel/clientes/[id]/page.tsx
'use client';
import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatarBRL } from '@locacoes/shared';
import { useState } from 'react';
import { NovoEndereco } from './NovoEndereco';

interface ClienteDetalhe {
  id: string; nome: string; cpfCnpj: string | null;
  telefones: { numero: string; tipo: string }[];
  rota: { nome: string };
  enderecos: { id: string; logradouro: string; numero: string; bairro: string; cidade: string }[];
  locacoes: {
    id: string; regra: string; status: string; saldoAtual: string; dataInicio: string;
    produto: { plaqueta: string; tipoProduto: { nome: string } };
    endereco: { logradouro: string; numero: string };
  }[];
  saldosDevedores: { id: string; valorRestante: string; locacao: { produto: { plaqueta: string } } }[];
}

interface Movimento {
  id: string; dataCobranca: string; valorLiquidoFinal: string; valorRecebidoPago: string;
  saldoResultante: string; formaPagamento: string; statusPagamento: string;
  locacao: { produto: { plaqueta: string } };
  usuario: { nome: string };
}

const NOME_REGRA: Record<string, string> = {
  VALOR_FIXO: 'Valor fixo', PERCENTUAL_A_RECEBER: '% a receber', PERCENTUAL_A_PAGAR: '% a pagar',
};
const NOME_FORMA: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX_MANUAL: 'PIX', CARTAO: 'Cartão', PIX_MERCADO_PAGO: 'PIX QR',
};

export default function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [novoEndereco, setNovoEndereco] = useState(false);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => api<ClienteDetalhe>(`/api/clientes/${id}`),
  });
  const { data: extrato } = useQuery({
    queryKey: ['extrato', id],
    queryFn: () => api<Movimento[]>(`/api/relatorios/extrato-cliente/${id}`),
  });

  if (isLoading) return <p className="p-8 text-stone-500">Carregando…</p>;
  if (!cliente) return <p className="p-8 text-red-600">Cliente não encontrado.</p>;

  const totalDividas = cliente.saldosDevedores.reduce((a, s) => a + Number(s.valorRestante), 0);
  const tel = cliente.telefones?.[0]?.numero;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Link href="/painel/clientes" className="text-sm text-stone-400 hover:text-feltro">← Clientes</Link>
      <div className="mb-6 mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-feltro">{cliente.nome}</h1>
          <p className="text-sm text-stone-500">
            Rota {cliente.rota.nome}
            {cliente.cpfCnpj && ` · ${cliente.cpfCnpj}`}
            {tel && (
              <> · <a className="text-feltro hover:underline" target="_blank" rel="noreferrer"
                href={`https://wa.me/55${tel.replace(/\D/g, '')}`}>WhatsApp {tel}</a></>
            )}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {cliente.enderecos.map((e) => `${e.logradouro}, ${e.numero} – ${e.bairro}`).join(' · ')}
            <button onClick={() => setNovoEndereco(!novoEndereco)}
              className="ml-2 text-feltro underline-offset-2 hover:underline">
              + endereço
            </button>
          </p>
        </div>
        {totalDividas > 0 && (
          <Link href="/painel/saldos"
            className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
            Dívidas: {formatarBRL(totalDividas)} →
          </Link>
        )}
      </div>

      {novoEndereco && <NovoEndereco clienteId={id} fechar={() => setNovoEndereco(false)} />}

      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-400">Locações</h2>
      <div className="mb-8 overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-stone-50 text-left text-xs uppercase text-stone-400">
            <th className="p-3">Produto</th><th>Regra</th><th>Início</th><th>Status</th><th className="p-3 text-right">Saldo</th>
          </tr></thead>
          <tbody>
            {cliente.locacoes.map((l) => {
              const saldo = Number(l.saldoAtual);
              return (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{l.produto.plaqueta} <span className="text-xs text-stone-400">{l.produto.tipoProduto.nome}</span></td>
                  <td>{NOME_REGRA[l.regra]}</td>
                  <td className="text-stone-500">{new Date(l.dataInicio).toLocaleDateString('pt-BR')}</td>
                  <td>{l.status === 'ATIVA' ? <span className="text-feltro">Ativa</span> : <span className="text-stone-400">Finalizada</span>}</td>
                  <td className={`p-3 text-right font-semibold ${saldo > 0 ? 'text-red-600' : saldo < 0 ? 'text-feltro' : 'text-stone-400'}`}>
                    {saldo === 0 ? '—' : saldo > 0 ? formatarBRL(saldo) : `haver ${formatarBRL(-saldo)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cliente.locacoes.length === 0 && <p className="p-5 text-center text-stone-400">Sem locações.</p>}
      </div>

      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-400">Extrato de cobranças</h2>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-stone-50 text-left text-xs uppercase text-stone-400">
            <th className="p-3">Data</th><th>Produto</th><th>Cobrador</th><th>Forma</th>
            <th className="text-right">Devido</th><th className="text-right">Pago</th><th className="p-3 text-right">Saldo</th>
          </tr></thead>
          <tbody>
            {extrato?.map((m) => {
              const saldo = Number(m.saldoResultante);
              return (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="p-3 text-stone-500">{new Date(m.dataCobranca).toLocaleDateString('pt-BR')}</td>
                  <td>{m.locacao.produto.plaqueta}</td>
                  <td className="text-stone-500">{m.usuario.nome}</td>
                  <td>
                    {NOME_FORMA[m.formaPagamento]}
                    {m.statusPagamento === 'PENDENTE' && <span className="ml-1 text-xs text-amber-600">pendente</span>}
                    {m.statusPagamento === 'PARCIAL' && <span className="ml-1 text-xs text-amber-600">parcial</span>}
                  </td>
                  <td className="text-right">{formatarBRL(m.valorLiquidoFinal)}</td>
                  <td className="text-right font-medium">{formatarBRL(m.valorRecebidoPago)}</td>
                  <td className={`p-3 text-right ${saldo > 0 ? 'text-red-600' : saldo < 0 ? 'text-feltro' : 'text-stone-400'}`}>
                    {saldo === 0 ? '—' : formatarBRL(saldo)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(extrato?.length ?? 0) === 0 && <p className="p-5 text-center text-stone-400">Nenhuma cobrança registrada.</p>}
      </div>
    </div>
  );
}
