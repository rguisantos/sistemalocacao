'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Botao, Campo, Tabela } from '@/components/ui/primitives';
import { MapaSeletor } from '@/components/MapaSeletor';

/** Gestão dos endereços de um cliente — embutida no cadastro do cliente. */
export function GerenciadorEnderecos({ clienteId }: { clienteId: string }) {
  const [enderecos, setEnderecos] = useState<any[]>([]);
  const [ed, setEd] = useState<any | null>(null);
  const [erro, setErro] = useState('');

  const carregar = () => api.get(`/enderecos?clienteId=${clienteId}`).then(setEnderecos).catch(() => setEnderecos([]));
  useEffect(() => { carregar(); }, [clienteId]);

  async function salvar() {
    setErro('');
    try {
      const dados = { logradouro: ed.logradouro, numero: ed.numero, bairro: ed.bairro, cidade: ed.cidade, estado: ed.estado, cep: ed.cep, complemento: ed.complemento, latitude: ed.latitude, longitude: ed.longitude };
      if (ed.id) await api.patch(`/enderecos/${ed.id}`, { ...dados, version: ed.version });
      else await api.post('/enderecos', { ...dados, clienteId });
      setEd(null); carregar();
    } catch (e: any) { setErro(e.message); }
  }
  async function excluir(e: any) { if (confirm('Excluir endereço?')) { await api.del(`/enderecos/${e.id}`); carregar(); } }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-suave font-medium text-sm">Endereços</p>
        <Botao variante="secundario" onClick={() => setEd({})}><Plus size={14} className="inline mr-1" /> Adicionar</Botao>
      </div>

      {!ed && (
        <Tabela colunas={['Logradouro', 'Cidade/UF', 'Coordenadas', '']}>
          {enderecos.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-suave">Nenhum endereço.</td></tr>}
          {enderecos.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-2">{e.logradouro}{e.numero ? `, ${e.numero}` : ''}</td>
              <td className="px-4 py-2">{e.cidade ?? '—'}{e.estado ? `/${e.estado}` : ''}</td>
              <td className="px-4 py-2 valor">{e.latitude && e.longitude ? `${Number(e.latitude).toFixed(4)}, ${Number(e.longitude).toFixed(4)}` : '—'}</td>
              <td className="px-4 py-2 text-right">
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEd(e)} className="text-suave hover:text-feltro"><Pencil size={15} /></button>
                  <button onClick={() => excluir(e)} className="text-suave hover:text-alerta"><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </Tabela>
      )}

      {ed && (
        <div className="border border-borda rounded-xl p-3 flex flex-col gap-3">
          <Campo label="Logradouro" value={ed.logradouro ?? ''} onChange={(e) => setEd({ ...ed, logradouro: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Número" value={ed.numero ?? ''} onChange={(e) => setEd({ ...ed, numero: e.target.value })} />
            <Campo label="Bairro" value={ed.bairro ?? ''} onChange={(e) => setEd({ ...ed, bairro: e.target.value })} />
            <Campo label="Cidade" value={ed.cidade ?? ''} onChange={(e) => setEd({ ...ed, cidade: e.target.value })} />
            <Campo label="UF" maxLength={2} value={ed.estado ?? ''} onChange={(e) => setEd({ ...ed, estado: e.target.value.toUpperCase() })} />
            <Campo label="CEP" value={ed.cep ?? ''} onChange={(e) => setEd({ ...ed, cep: e.target.value })} />
            <Campo label="Complemento" value={ed.complemento ?? ''} onChange={(e) => setEd({ ...ed, complemento: e.target.value })} />
          </div>
          <MapaSeletor latitude={ed.latitude} longitude={ed.longitude} onChange={(lat, lng) => setEd({ ...ed, latitude: lat, longitude: lng })} />
          {erro && <p className="text-alerta text-sm">{erro}</p>}
          <div className="flex gap-2 justify-end">
            <Botao variante="secundario" onClick={() => setEd(null)}>Cancelar</Botao>
            <Botao onClick={salvar}>Salvar endereço</Botao>
          </div>
        </div>
      )}
    </div>
  );
}
