'use client';

/** Busca automática de endereço pelo CEP via ViaCEP. */
export async function buscarCep(cep: string): Promise<Record<string, string> | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      cidade: data.localidade ?? '',
      estado: data.uf ?? '',
      cep: digits,
    };
  } catch {
    return null;
  }
}
