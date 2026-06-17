import { Decimal } from 'decimal.js';
import {
  Dinheiro, arredondar, somar, subtrair, multiplicar,
  aplicarPercentual, ehNegativo, menorQue,
} from './money';
import { diasEntre, periodosDecorridos, proximaDataPeriodo, Frequencia } from './datas';

/**
 * Motor de cálculo de cobranças. Funções PURAS e determinísticas — toda a
 * correção financeira do sistema vive aqui, com cobertura de testes.
 *
 * CONVENÇÃO DE SINAL DO SALDO (decisão da auditoria — P1):
 *   saldoDevedorAtual representa "o quanto ainda falta liquidar nesta locação".
 *   A direção (quem deve a quem) vem da `regra`, não do sinal:
 *     - VALOR_FIXO / PERCENTUAL_A_RECEBER: saldo > 0 => CLIENTE deve à empresa.
 *     - PERCENTUAL_A_PAGAR:                saldo > 0 => EMPRESA deve ao cliente.
 *   Saldo negativo = haver (crédito) na mesma locação, em qualquer modo.
 *   Por isso a aritmética é uniforme: liquidoFinal = base + saldoAnterior, e
 *   novoSaldo = liquidoFinal - valorPago. A UI rotula a direção a partir da regra.
 */

export type Regra = 'VALOR_FIXO' | 'PERCENTUAL_A_RECEBER' | 'PERCENTUAL_A_PAGAR';


/** Linha do memorial de cálculo (persistido e exibido no recibo). */
export interface PassoMemorial { rotulo: string; valor: string; }

export interface ResultadoCobranca {
  valorBruto: Dinheiro | null;
  valorPercentual: Dinheiro | null;
  valorLiquidoBase: Dinheiro;
  saldoDevedorAnterior: Dinheiro;
  valorLiquidoFinal: Dinheiro;
  memorial: PassoMemorial[];
  /** true quando, em PERCENTUAL_A_PAGAR, o valor pago for menor que o devido. */
  alertaPagamentoInferior: boolean;
}

// ---------------------------------------------------------------------------
// VALOR FIXO
// ---------------------------------------------------------------------------
export interface EntradaValorFixo {
  valorFixo: Decimal.Value;
  frequencia: Frequencia;
  dataReferencia: Date;          // última cobrança ou dataInicio
  hoje: Date;
  acrescimo?: Decimal.Value;     // opcional (toggle)
  saldoAnterior?: Decimal.Value; // +/-
}

export function calcularValorFixo(e: EntradaValorFixo): ResultadoCobranca & {
  periodos: number; dias: number;
  /** Data (YYYY-MM-DD) em que o próximo período passa a acumular. */
  dataProximoPeriodo: string;
  /** true quando há mais de um período devido — a UI pede confirmação antes de aplicar. */
  requerConfirmacaoPeriodoExtra: boolean;
} {
  const dias = diasEntre(e.dataReferencia, e.hoje);
  const periodos = periodosDecorridos(e.frequencia, e.dataReferencia, e.hoje);
  const dataProximoPeriodo = proximaDataPeriodo(e.frequencia, e.dataReferencia, periodos);
  const requerConfirmacaoPeriodoExtra = periodos > 1;
  const acrescimo = arredondar(e.acrescimo ?? 0);
  const saldoAnterior = arredondar(e.saldoAnterior ?? 0);

  const valorTotal = somar(multiplicar(e.valorFixo, periodos), acrescimo);
  const base = arredondar(valorTotal);
  const liquidoFinal = arredondar(somar(base, saldoAnterior));

  const memorial: PassoMemorial[] = [
    { rotulo: `Dias desde a última cobrança`, valor: String(dias) },
    { rotulo: `Períodos cobráveis`, valor: String(periodos) },
    { rotulo: `Valor por período`, valor: arredondar(e.valorFixo).toFixed(2) },
  ];
  if (!acrescimo.isZero()) memorial.push({ rotulo: 'Acréscimo', valor: acrescimo.toFixed(2) });
  if (!saldoAnterior.isZero()) memorial.push({ rotulo: 'Saldo anterior', valor: saldoAnterior.toFixed(2) });

  return {
    periodos, dias, dataProximoPeriodo, requerConfirmacaoPeriodoExtra,
    valorBruto: null, valorPercentual: null,
    valorLiquidoBase: base,
    saldoDevedorAnterior: saldoAnterior,
    valorLiquidoFinal: liquidoFinal,
    memorial,
    alertaPagamentoInferior: false,
  };
}

// ---------------------------------------------------------------------------
// PERCENTUAL (a receber / a pagar)
// ---------------------------------------------------------------------------
export interface EntradaPercentual {
  regra: 'PERCENTUAL_A_RECEBER' | 'PERCENTUAL_A_PAGAR';
  contadorAnterior: number;
  contadorAtual: number;
  contadorReiniciado?: boolean;        // [AUDIT P2] rollover/troca de contador
  valorPartida: Decimal.Value;
  percentual: Decimal.Value;           // taxa, ex.: 30
  descontoPartidas?: number;           // opcional (toggle)
  acrescimo?: Decimal.Value;           // opcional (toggle)
  descontoValorReceber?: Decimal.Value; // só A_RECEBER
  saldoAnterior?: Decimal.Value;
}

export function calcularPercentual(e: EntradaPercentual): ResultadoCobranca & {
  partidasJogadas: number; partidasConsideradas: number;
} {
  // Tratamento de contador reiniciado: se reiniciou, as "partidas jogadas"
  // não podem ser inferidas pela diferença — o operador informa o atual como
  // total do novo ciclo. Sem reinício, exige atual >= anterior.
  let partidasJogadas: number;
  if (e.contadorReiniciado) {
    partidasJogadas = Math.max(0, e.contadorAtual);
  } else {
    partidasJogadas = e.contadorAtual - e.contadorAnterior;
    if (partidasJogadas < 0) {
      throw new Error(
        'Contador atual menor que o anterior sem marcar reinício. ' +
        'Marque "contador reiniciado" se a peça foi trocada/zerada.',
      );
    }
  }

  const descontoPartidas = Math.max(0, e.descontoPartidas ?? 0);
  const partidasConsideradas = Math.max(0, partidasJogadas - descontoPartidas);
  const acrescimo = arredondar(e.acrescimo ?? 0);
  const saldoAnterior = arredondar(e.saldoAnterior ?? 0);

  const valorBruto = arredondar(somar(multiplicar(e.valorPartida, partidasConsideradas), acrescimo));
  const valorPercentual = aplicarPercentual(valorBruto, e.percentual);

  let base: Dinheiro;
  if (e.regra === 'PERCENTUAL_A_RECEBER') {
    const desconto = arredondar(e.descontoValorReceber ?? 0);
    base = arredondar(subtrair(valorPercentual, desconto));
  } else {
    base = valorPercentual; // A_PAGAR não tem desconto no valor a receber
  }

  const liquidoFinal = arredondar(somar(base, saldoAnterior));

  const memorial: PassoMemorial[] = [
    { rotulo: 'Partidas jogadas', valor: String(partidasJogadas) },
  ];
  if (descontoPartidas > 0) memorial.push({ rotulo: 'Desconto de partidas', valor: `-${descontoPartidas}` });
  memorial.push({ rotulo: 'Partidas consideradas', valor: String(partidasConsideradas) });
  memorial.push({ rotulo: 'Valor por partida', valor: arredondar(e.valorPartida).toFixed(2) });
  if (!acrescimo.isZero()) memorial.push({ rotulo: 'Acréscimo', valor: acrescimo.toFixed(2) });
  memorial.push({ rotulo: 'Valor bruto', valor: valorBruto.toFixed(2) });
  memorial.push({ rotulo: `Percentual (${new Decimal(e.percentual).toString()}%)`, valor: valorPercentual.toFixed(2) });
  if (e.regra === 'PERCENTUAL_A_RECEBER' && e.descontoValorReceber)
    memorial.push({ rotulo: 'Desconto no valor', valor: `-${arredondar(e.descontoValorReceber).toFixed(2)}` });
  if (!saldoAnterior.isZero()) memorial.push({ rotulo: 'Saldo anterior', valor: saldoAnterior.toFixed(2) });

  return {
    partidasJogadas, partidasConsideradas,
    valorBruto, valorPercentual,
    valorLiquidoBase: base,
    saldoDevedorAnterior: saldoAnterior,
    valorLiquidoFinal: liquidoFinal,
    memorial,
    alertaPagamentoInferior: false,
  };
}

// ---------------------------------------------------------------------------
// PÓS-PAGAMENTO: novo saldo + alerta (5.3 / 5.2.11)
// ---------------------------------------------------------------------------
export interface ResultadoPagamento {
  novoSaldo: Dinheiro;
  alertaPagamentoInferior: boolean;
}

export function aplicarPagamento(
  regra: Regra,
  valorLiquidoFinal: Decimal.Value,
  valorRecebidoPago: Decimal.Value,
): ResultadoPagamento {
  const novoSaldo = arredondar(subtrair(valorLiquidoFinal, valorRecebidoPago));
  const alertaPagamentoInferior =
    regra === 'PERCENTUAL_A_PAGAR' &&
    !ehNegativo(valorLiquidoFinal) &&
    menorQue(valorRecebidoPago, valorLiquidoFinal);
  return { novoSaldo, alertaPagamentoInferior };
}

/**
 * Recalcula o saldo de uma locação a partir do histórico (fonte da verdade).
 * [AUDIT P0] O saldo NUNCA é confiado do mobile via LWW; é derivado aqui.
 *
 * saldo = Σ (valorLiquidoBASE de cada cobrança) − Σ (pagamentos)
 * Usa-se a BASE (não o líquido final), porque o líquido final de cada cobrança
 * já embute o saldo anterior — somar finais contaria o saldo várias vezes.
 */
export function recalcularSaldoLocacao(
  valoresBaseDevidos: Decimal.Value[],
  valoresPagos: Decimal.Value[],
): Dinheiro {
  const devido = somar(...valoresBaseDevidos);
  const pago = somar(...valoresPagos);
  return arredondar(subtrair(devido, pago));
}
