/** Máscaras de entrada para campos brasileiros. */

export function mascararCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function mascararCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function mascararCpfCnpj(v: string) {
  const d = v.replace(/\D/g, '');
  return d.length > 11 ? mascararCnpj(v) : mascararCpf(v);
}

export function mascararTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 6) return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  if (d.length > 2) return d.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  return d;
}

export function mascararCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})$/, '$1-$2');
}

export function desmascarar(v: string) {
  return v.replace(/\D/g, '');
}
