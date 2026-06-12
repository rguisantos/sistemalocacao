import Decimal from 'decimal.js';

/**
 * Utilitários monetários. NUNCA usar float para dinheiro.
 * Internamente: Decimal.js. Nas APIs, valores trafegam como string.
 */
export const D = (v: Decimal.Value): Decimal => new Decimal(v ?? 0);

export const arredondar = (v: Decimal): Decimal =>
  v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const formatarBRL = (v: Decimal.Value): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    new Decimal(v ?? 0).toNumber()
  );

/** Converte string "1.234,56" ou "1234.56" em Decimal */
export const parseBRL = (s: string): Decimal => {
  const limpo = s.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return new Decimal(limpo || 0);
};
