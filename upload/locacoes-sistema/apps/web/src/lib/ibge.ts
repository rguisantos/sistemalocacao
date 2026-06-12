// API pública do IBGE para estados e municípios (sem chave).
export interface UF { id: number; sigla: string; nome: string }
export interface Municipio { id: number; nome: string }

const BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';

export async function listarEstados(): Promise<UF[]> {
  const r = await fetch(`${BASE}/estados?orderBy=nome`);
  if (!r.ok) throw new Error('Falha ao consultar estados (IBGE)');
  return r.json();
}

export async function listarMunicipios(uf: string): Promise<Municipio[]> {
  const r = await fetch(`${BASE}/estados/${uf}/municipios?orderBy=nome`);
  if (!r.ok) throw new Error('Falha ao consultar municípios (IBGE)');
  return r.json();
}
