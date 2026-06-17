import { Decimal } from 'decimal.js';

/**
 * Política monetária do sistema (decisão da auditoria — P0).
 * - Todo valor monetário usa Decimal (nunca float/parseInt).
 * - 2 casas decimais, arredondamento HALF_UP, aplicado em cada valor
 *   monetário que é persistido ou exibido.
 * - A taxa percentual é uma razão (ex.: 30, 12.5), não monetária.
 *
 * Configuração global da biblioteca para refletir essa política.
 */
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export type Dinheiro = Decimal;

export const dinheiro = (v: Decimal.Value): Dinheiro => new Decimal(v);

/** Arredonda para 2 casas (HALF_UP). Use ao persistir/exibir qualquer valor em R$. */
export const arredondar = (v: Decimal.Value): Dinheiro =>
  new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const somar = (...vs: Decimal.Value[]): Dinheiro =>
  vs.reduce<Dinheiro>((acc, v) => acc.plus(v), new Decimal(0));

export const subtrair = (a: Decimal.Value, b: Decimal.Value): Dinheiro =>
  new Decimal(a).minus(b);

export const multiplicar = (a: Decimal.Value, b: Decimal.Value): Dinheiro =>
  new Decimal(a).times(b);

/** Aplica uma taxa percentual (ex.: 30 = 30%) sobre um valor e arredonda. */
export const aplicarPercentual = (valor: Decimal.Value, taxa: Decimal.Value): Dinheiro =>
  arredondar(new Decimal(valor).times(taxa).dividedBy(100));

export const ehNegativo = (v: Decimal.Value): boolean => new Decimal(v).isNegative();
export const ehZero = (v: Decimal.Value): boolean => new Decimal(v).isZero();
export const menorQue = (a: Decimal.Value, b: Decimal.Value): boolean => new Decimal(a).lessThan(b);

/** Formata em pt-BR para exibição/recibo. */
export const formatarBRL = (v: Decimal.Value | null | undefined): string =>
  new Decimal(v ?? 0)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber()
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
