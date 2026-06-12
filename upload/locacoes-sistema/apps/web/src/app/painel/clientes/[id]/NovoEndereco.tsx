'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { listarEstados, listarMunicipios } from '@/lib/ibge';

export function NovoEndereco({ clienteId, fechar }: { clienteId: string; fechar: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    logradouro: '', numero: '', complemento: '', bairro: '',
    estado: '', cidade: '', cep: '', principal: false,
  });
  const [erro, setErro] = useState('');

  // Estado/cidade dinâmicos via API IBGE
  const { data: estados } = useQuery({ queryKey: ['ibge-ufs'], queryFn: listarEstados, staleTime: Infinity });
  const { data: cidades } = useQuery({
    queryKey: ['ibge-municipios', form.estado],
    queryFn: () => listarMunicipios(form.estado),
    enabled: !!form.estado,
    staleTime: Infinity,
  });

  const criar = useMutation({
    mutationFn: () =>
      api(`/api/clientes/${clienteId}/enderecos`, {
        method: 'POST',
        body: JSON.stringify({ ...form, cep: form.cep.replace(/\D/g, ''), complemento: form.complemento || null }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cliente', clienteId] }); fechar(); },
    onError: (e: Error) => setErro(e.message),
  });

  const valido = form.logradouro && form.numero && form.bairro &&
    form.estado && form.cidade && form.cep.replace(/\D/g, '').length === 8;

  return (
    <div className="mb-6 grid gap-3 rounded-xl border-2 border-primary/30 bg-card p-5 shadow-sm sm:grid-cols-3">
      <p className="text-sm font-semibold text-feltro sm:col-span-3">Novo endereço</p>
      <input className="rounded-lg border px-3 py-2 sm:col-span-2" placeholder="Logradouro *" value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} />
      <input className="rounded-lg border px-3 py-2" placeholder="Número *" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
      <input className="rounded-lg border px-3 py-2" placeholder="Complemento" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
      <input className="rounded-lg border px-3 py-2" placeholder="Bairro *" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
      <input className="rounded-lg border px-3 py-2" placeholder="CEP * (8 dígitos)" maxLength={8} value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value.replace(/\D/g, '') })} />

      <select className="rounded-lg border px-3 py-2" value={form.estado}
        onChange={(e) => setForm({ ...form, estado: e.target.value, cidade: '' })}>
        <option value="">Estado * (IBGE)</option>
        {estados?.map((uf) => <option key={uf.id} value={uf.sigla}>{uf.nome}</option>)}
      </select>
      <select className="rounded-lg border px-3 py-2" value={form.cidade} disabled={!form.estado}
        onChange={(e) => setForm({ ...form, cidade: e.target.value })}>
        <option value="">{form.estado ? 'Cidade * (IBGE)' : 'Selecione o estado'}</option>
        {cidades?.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm text-foreground/80">
        <input type="checkbox" checked={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.checked })} />
        Endereço principal
      </label>

      {erro && <p className="text-sm text-destructive sm:col-span-3">{erro}</p>}
      <div className="flex gap-2 sm:col-span-3">
        <button onClick={() => criar.mutate()} disabled={!valido || criar.isPending}
          className="rounded-lg bg-feltro px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Salvar endereço
        </button>
        <button onClick={fechar} className="rounded-lg border px-4 py-2 text-sm text-muted-foreground">Cancelar</button>
      </div>
    </div>
  );
}
