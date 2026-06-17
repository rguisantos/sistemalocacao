import { formatarBRL } from '@app/core';
export { formatarBRL };
export const data = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
