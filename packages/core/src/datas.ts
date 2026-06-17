/**
 * Cálculo de períodos e vencimento (decisões de negócio confirmadas).
 *
 * Fuso fixo (default America/Sao_Paulo), contagem por data de calendário.
 *
 * Modelo de período: "período atual + cada período completo decorrido".
 *   periodos = 1 + (períodos completos desde a referência)
 *   - SEMANAL / QUINZENAL: período completo = bloco de 7 / 15 dias.
 *   - MENSAL: período completo = mês-calendário (não 30 dias fixos).
 * A UI sugere o valor do(s) período(s) e, quando periodos > 1, pede
 * confirmação ("já há outro período, deseja atualizar o valor?").
 */
export const FUSO_OPERACAO = 'America/Sao_Paulo';
export type Frequencia = 'SEMANAL' | 'QUINZENAL' | 'MENSAL';

interface YMD { y: number; m: number; d: number; }

function ymdLocal(data: Date, fuso: string): YMD {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const p = Object.fromEntries(
    fmt.formatToParts(data).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]),
  ) as { year: number; month: number; day: number };
  return { y: p.year, m: p.month, d: p.day };
}

const diaNumero = (y: number, m: number, d: number): number =>
  Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);

const ultimoDiaDoMes = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Dias inteiros entre duas datas, no fuso da operação. Nunca negativo. */
export function diasEntre(de: Date, ate: Date, fuso = FUSO_OPERACAO): number {
  const a = ymdLocal(de, fuso), b = ymdLocal(ate, fuso);
  return Math.max(0, diaNumero(b.y, b.m, b.d) - diaNumero(a.y, a.m, a.d));
}

/** Meses-calendário completos decorridos entre `de` e `ate` (com clamp de fim de mês). */
export function mesesCalendarioDecorridos(de: Date, ate: Date, fuso = FUSO_OPERACAO): number {
  const a = ymdLocal(de, fuso), b = ymdLocal(ate, fuso);
  let meses = (b.y - a.y) * 12 + (b.m - a.m);
  const diaAniversario = Math.min(a.d, ultimoDiaDoMes(b.y, b.m)); // 31/jan -> 28/fev
  if (b.d < diaAniversario) meses--;
  return Math.max(0, meses);
}

/** Data (YYYY-MM-DD) do k-ésimo aniversário mensal da referência, com clamp de fim de mês. */
export function adicionarMeses(ref: Date, k: number, fuso = FUSO_OPERACAO): string {
  const a = ymdLocal(ref, fuso);
  const totalMeses = (a.m - 1) + k;
  const y = a.y + Math.floor(totalMeses / 12);
  const m = (((totalMeses % 12) + 12) % 12) + 1;
  const d = Math.min(a.d, ultimoDiaDoMes(y, m));
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Períodos devidos = período atual + cada período completo decorrido. */
export function periodosDecorridos(freq: Frequencia, ref: Date, hoje: Date, fuso = FUSO_OPERACAO): number {
  if (freq === 'MENSAL') return 1 + mesesCalendarioDecorridos(ref, hoje, fuso);
  const passo = freq === 'SEMANAL' ? 7 : 15;
  return 1 + Math.floor(diasEntre(ref, hoje, fuso) / passo);
}

/** Data em que o PRÓXIMO período passa a acumular (gatilho do aviso na UI). */
export function proximaDataPeriodo(
  freq: Frequencia, ref: Date, periodosAtuais: number, fuso = FUSO_OPERACAO,
): string {
  if (freq === 'MENSAL') return adicionarMeses(ref, periodosAtuais, fuso);
  const passo = freq === 'SEMANAL' ? 7 : 15;
  const a = ymdLocal(ref, fuso);
  const alvo = diaNumero(a.y, a.m, a.d) + periodosAtuais * passo;
  const dt = new Date(alvo * 86_400_000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// VENCIMENTO / ATRASO (para o job de notificação)
// ---------------------------------------------------------------------------

/**
 * VALOR FIXO atrasado: passou ao menos um período completo desde a última
 * cobrança (periodos > 1), ou seja, a data do próximo período já foi cruzada.
 */
export function vencidaValorFixo(freq: Frequencia, dataUltimaCobranca: Date, hoje: Date, fuso = FUSO_OPERACAO): boolean {
  return periodosDecorridos(freq, dataUltimaCobranca, hoje, fuso) > 1;
}

/**
 * PERCENTUAL atrasado: passou mais de X dias da última cobrança efetuada.
 * X (diasTolerancia) é parâmetro de configuração do sistema (ou por locação).
 */
export function vencidaPercentual(dataUltimaCobranca: Date, hoje: Date, diasTolerancia: number, fuso = FUSO_OPERACAO): boolean {
  return diasEntre(dataUltimaCobranca, hoje, fuso) > diasTolerancia;
}
