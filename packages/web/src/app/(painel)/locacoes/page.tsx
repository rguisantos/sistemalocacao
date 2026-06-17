'use client';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatarBRL } from '@/lib/format';
import { Botao, Campo, Dialogo, Tabela } from '@/components/ui/primitives';

export default function Locacoes() {
  const { pode } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [locacoes, setLocacoes] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [enderecos, setEnderecos] = useState<any[]>([]);
  const [depositos, setDepositos] = useState<any[]>([]);
  const [nova, setNova] = useState<any | null>(null);
  const [finalizar, setFinalizar] = useState<any | null>(null);
  const [endsNovoCliente, setEndsNovoCliente] = useState<any[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get('/clientes').then(setClientes).catch(() => setClientes([]));
    api.get('/produtos').then(setProdutos).catch(() => setProdutos([]));
    api.get('/depositos').then(setDepositos).catch(() => setDepositos([]));
  }, []);
  const carregar = () => clienteId && api.get(`/locacoes?clienteId=${clienteId}`).then(setLocacoes).catch(() => setLocacoes([]));
  useEffect(() => {
    setLocacoes([]);
    if (clienteId) { carregar(); api.get(`/enderecos?clienteId=${clienteId}`).then(setEnderecos).catch(() => setEnderecos([])); }
  }, [clienteId]);

  async function criar() {
    setErro('');
    try {
      const base: any = { produtoId: nova.produtoId, clienteId, enderecoId: nova.enderecoId, regra: nova.regra };
      if (nova.regra === 'VALOR_FIXO') { base.frequencia = nova.frequencia ?? 'MENSAL'; base.valorFixo = Number(nova.valorFixo); }
      else { base.valorPartida = Number(nova.valorPartida); base.percentual = Number(nova.percentual); }
      if (nova.contadorInicial) base.contadorInicial = Number(nova.contadorInicial);
      await api.post('/locacoes', base);
      setNova(null); carregar();
    } catch (e: any) { setErro(e.message); }
  }
  async function confirmarFinalizacao() {
    setErro('');
    try {
      const corpo: any = { tipo: finalizar.tipo };
      if (finalizar.tipo === 'DEPOSITO') corpo.depositoId = finalizar.depositoId;
      else corpo.novaLocacao = { clienteId: finalizar.novoClienteId, enderecoId: finalizar.novoEnderecoId };
      await api.post(`/locacoes/${finalizar.id}/finalizar`, corpo);
      setFinalizar(null); carregar();
    } catch (e: any) { setErro(e.message); }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Locações</h1>

      <label className="flex flex-col gap-1.5 text-sm max-w-sm">
        <span className="text-suave font-medium">Cliente</span>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="border border-borda rounded-xl px-3 py-2 bg-white">
          <option value="">Selecione…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>

      {clienteId && (
        <>
          <div className="flex justify-end">
            {pode('locacoes.criar') && <Botao onClick={() => setNova({ regra: 'VALOR_FIXO' })}><Plus size={16} className="inline mr-1" /> Nova locação</Botao>}
          </div>
          <Tabela colunas={['Produto', 'Regra', 'Saldo', '']}>
            {locacoes.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-suave">Sem locações ativas para este cliente.</td></tr>}
            {locacoes.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3">{l.produto?.plaqueta} {l.produto?.descricao ?? ''}</td>
                <td className="px-4 py-3">{l.regra}</td>
                <td className="px-4 py-3 valor">{formatarBRL(l.saldoDevedorAtual)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setFinalizar({ id: l.id, tipo: 'DEPOSITO' })} className="text-suave hover:text-alerta text-sm">Finalizar</button>
                </td>
              </tr>
            ))}
          </Tabela>
        </>
      )}
      {erro && <p className="text-alerta text-sm">{erro}</p>}

      {/* Nova locação */}
      <Dialogo aberto={!!nova} aoFechar={() => setNova(null)} titulo="Nova locação">
        {nova && (
          <div className="flex flex-col gap-3">
            <Selecao label="Produto" value={nova.produtoId} onChange={(v) => setNova({ ...nova, produtoId: v })} opcoes={produtos.map((p) => ({ id: p.id, rotulo: `${p.plaqueta} ${p.descricao ?? ''}` }))} />
            <Selecao label="Endereço" value={nova.enderecoId} onChange={(v) => setNova({ ...nova, enderecoId: v })} opcoes={enderecos.map((e) => ({ id: e.id, rotulo: e.logradouro }))} />
            <Selecao label="Regra" value={nova.regra} onChange={(v) => setNova({ ...nova, regra: v })} opcoes={[{ id: 'VALOR_FIXO', rotulo: 'Valor fixo' }, { id: 'PERCENTUAL_A_RECEBER', rotulo: 'Percentual a receber' }, { id: 'PERCENTUAL_A_PAGAR', rotulo: 'Percentual a pagar' }]} />
            {nova.regra === 'VALOR_FIXO' ? (
              <>
                <Selecao label="Frequência" value={nova.frequencia ?? 'MENSAL'} onChange={(v) => setNova({ ...nova, frequencia: v })} opcoes={[{ id: 'SEMANAL', rotulo: 'Semanal' }, { id: 'QUINZENAL', rotulo: 'Quinzenal' }, { id: 'MENSAL', rotulo: 'Mensal' }]} />
                <Campo label="Valor fixo (R$)" inputMode="decimal" value={nova.valorFixo ?? ''} onChange={(e) => setNova({ ...nova, valorFixo: e.target.value })} />
              </>
            ) : (
              <>
                <Campo label="Valor por partida (R$)" inputMode="decimal" value={nova.valorPartida ?? ''} onChange={(e) => setNova({ ...nova, valorPartida: e.target.value })} />
                <Campo label="Percentual (%)" inputMode="decimal" value={nova.percentual ?? ''} onChange={(e) => setNova({ ...nova, percentual: e.target.value })} />
                <Campo label="Contador inicial" inputMode="numeric" value={nova.contadorInicial ?? ''} onChange={(e) => setNova({ ...nova, contadorInicial: e.target.value })} />
              </>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <Botao variante="secundario" onClick={() => setNova(null)}>Cancelar</Botao>
              <Botao onClick={criar}>Criar</Botao>
            </div>
          </div>
        )}
      </Dialogo>

      {/* Finalizar */}
      <Dialogo aberto={!!finalizar} aoFechar={() => setFinalizar(null)} titulo="Finalizar locação">
        {finalizar && (
          <div className="flex flex-col gap-3">
            <Selecao label="Destino" value={finalizar.tipo} onChange={(v) => setFinalizar({ ...finalizar, tipo: v })} opcoes={[{ id: 'DEPOSITO', rotulo: 'Depósito' }, { id: 'RELOCACAO', rotulo: 'Relocação' }]} />
            {finalizar.tipo === 'DEPOSITO' ? (
              <Selecao label="Depósito" value={finalizar.depositoId} onChange={(v) => setFinalizar({ ...finalizar, depositoId: v })} opcoes={depositos.map((d) => ({ id: d.id, rotulo: d.nome }))} />
            ) : (
              <>
                <Selecao label="Novo cliente" value={finalizar.novoClienteId} onChange={(v) => { setFinalizar({ ...finalizar, novoClienteId: v, novoEnderecoId: '' }); setEndsNovoCliente([]); if (v) api.get(`/enderecos?clienteId=${v}`).then(setEndsNovoCliente).catch(() => setEndsNovoCliente([])); }} opcoes={clientes.map((c) => ({ id: c.id, rotulo: c.nome }))} />
                <Selecao label="Endereço do novo cliente" value={finalizar.novoEnderecoId} onChange={(v) => setFinalizar({ ...finalizar, novoEnderecoId: v })} opcoes={endsNovoCliente.map((e) => ({ id: e.id, rotulo: `${e.logradouro}${e.numero ? ', ' + e.numero : ''}` }))} />
              </>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <Botao variante="secundario" onClick={() => setFinalizar(null)}>Cancelar</Botao>
              <Botao variante="perigo" onClick={confirmarFinalizacao}>Finalizar</Botao>
            </div>
          </div>
        )}
      </Dialogo>
    </div>
  );
}

function Selecao({ label, value, onChange, opcoes }: { label: string; value?: string; onChange: (v: string) => void; opcoes: { id: string; rotulo: string }[] }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-suave font-medium">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="border border-borda rounded-xl px-3 py-2 bg-white">
        <option value="">Selecione…</option>
        {opcoes.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
      </select>
    </label>
  );
}
