// packages/shared/src/utils/calculo.ts
// ============================================================
// ENGINE DE CÁLCULO DE COBRANÇA
// Compartilhado entre API, Web e Mobile — garante que o cálculo
// offline (mobile) seja IDÊNTICO ao do servidor.
// Todos os valores monetários como string (Decimal internamente).
// ============================================================
import Decimal from 'decimal.js';
import { D, arredondar } from './dinheiro';

export type RegraCobranca = 'VALOR_FIXO' | 'PERCENTUAL_A_RECEBER' | 'PERCENTUAL_A_PAGAR';
export type FrequenciaCobranca = 'SEMANAL' | 'QUINZENAL' | 'MENSAL';

export const DIAS_FREQUENCIA: Record<FrequenciaCobranca, number> = {
  SEMANAL: 7,
  QUINZENAL: 15,
  MENSAL: 30,
};

export interface PassoCalculo {
  descricao: string;
  valor: string;
}

// ------------------------------------------------------------
// VALOR FIXO
// ------------------------------------------------------------
export interface InputValorFixo {
  frequencia: FrequenciaCobranca;
  valorFixo: string;           // decimal string
  dataReferencia: Date;        // última cobrança ou data_inicio da locação
  dataAtual: Date;
  acrescimo?: string;
  saldoDevedorAnterior?: string; // positivo = deve, negativo = haver
}

export interface ResultadoValorFixo {
  regra: 'VALOR_FIXO';
  diasDecorridos: number;
  periodos: number;
  valorBruto: string;          // periodos * valorFixo
  acrescimo: string;
  valorLiquidoBase: string;    // bruto + acréscimo
  saldoDevedorAnterior: string;
  valorLiquidoFinal: string;
  passos: PassoCalculo[];
}

export function calcularValorFixo(input: InputValorFixo): ResultadoValorFixo {
  const msPorDia = 1000 * 60 * 60 * 24;
  const diasDecorridos = Math.max(
    0,
    Math.floor((input.dataAtual.getTime() - input.dataReferencia.getTime()) / msPorDia)
  );
  const diasFreq = DIAS_FREQUENCIA[input.frequencia];
  const periodos = Math.max(1, Math.ceil(diasDecorridos / diasFreq));

  const valorFixo = D(input.valorFixo);
  const acrescimo = D(input.acrescimo ?? 0);
  const saldoAnterior = D(input.saldoDevedorAnterior ?? 0);

  const valorBruto = arredondar(valorFixo.mul(periodos));
  const valorLiquidoBase = arredondar(valorBruto.add(acrescimo));
  const valorLiquidoFinal = arredondar(valorLiquidoBase.add(saldoAnterior));

  const passos: PassoCalculo[] = [
    { descricao: `Dias desde a última cobrança`, valor: `${diasDecorridos} dias` },
    { descricao: `Períodos (${input.frequencia.toLowerCase()})`, valor: `${periodos}x` },
    { descricao: `Valor (${periodos} × ${valorFixo.toFixed(2)})`, valor: valorBruto.toFixed(2) },
  ];
  if (!acrescimo.isZero()) passos.push({ descricao: 'Acréscimo', valor: acrescimo.toFixed(2) });
  if (!saldoAnterior.isZero())
    passos.push({
      descricao: saldoAnterior.gt(0) ? 'Saldo devedor anterior' : 'Haver anterior',
      valor: saldoAnterior.toFixed(2),
    });
  passos.push({ descricao: 'Valor líquido final', valor: valorLiquidoFinal.toFixed(2) });

  return {
    regra: 'VALOR_FIXO',
    diasDecorridos,
    periodos,
    valorBruto: valorBruto.toFixed(2),
    acrescimo: acrescimo.toFixed(2),
    valorLiquidoBase: valorLiquidoBase.toFixed(2),
    saldoDevedorAnterior: saldoAnterior.toFixed(2),
    valorLiquidoFinal: valorLiquidoFinal.toFixed(2),
    passos,
  };
}

// ------------------------------------------------------------
// PERCENTUAL (A RECEBER / A PAGAR)
// ------------------------------------------------------------
export interface InputPercentual {
  regra: 'PERCENTUAL_A_RECEBER' | 'PERCENTUAL_A_PAGAR';
  contadorAnterior: number;
  contadorAtual: number;
  valorPartida: string;        // ex: "2.50"
  percentual: string;          // fração: "0.5" = 50%
  descontoPartidas?: number;
  acrescimo?: string;
  descontoValorReceber?: string; // só PERCENTUAL_A_RECEBER
  saldoDevedorAnterior?: string;
}

export interface ResultadoPercentual {
  regra: 'PERCENTUAL_A_RECEBER' | 'PERCENTUAL_A_PAGAR';
  partidasJogadas: number;
  descontoPartidas: number;
  partidasConsideradas: number;
  valorBruto: string;
  acrescimo: string;
  valorPercentual: string;
  descontoValorReceber: string;
  valorLiquidoBase: string;
  saldoDevedorAnterior: string;
  valorLiquidoFinal: string;
  passos: PassoCalculo[];
  erros: string[];
}

export function calcularPercentual(input: InputPercentual): ResultadoPercentual {
  const erros: string[] = [];

  if (input.contadorAtual < input.contadorAnterior) {
    erros.push(
      `Contador atual (${input.contadorAtual}) menor que o anterior (${input.contadorAnterior}). Verifique a leitura.`
    );
  }

  const partidasJogadas = Math.max(0, input.contadorAtual - input.contadorAnterior);
  const descontoPartidas = Math.max(0, input.descontoPartidas ?? 0);

  if (descontoPartidas > partidasJogadas) {
    erros.push('Desconto de partidas maior que partidas jogadas.');
  }
  const partidasConsideradas = Math.max(0, partidasJogadas - descontoPartidas);

  const valorPartida = D(input.valorPartida);
  const percentual = D(input.percentual);
  const acrescimo = D(input.acrescimo ?? 0);
  const descontoValorReceber =
    input.regra === 'PERCENTUAL_A_RECEBER' ? D(input.descontoValorReceber ?? 0) : D(0);
  const saldoAnterior = D(input.saldoDevedorAnterior ?? 0);

  // valor_bruto = (partidas_consideradas * valor_partida) + acrescimo
  const valorBruto = arredondar(valorPartida.mul(partidasConsideradas).add(acrescimo));
  // valor_percentual = valor_bruto * percentual
  const valorPercentual = arredondar(valorBruto.mul(percentual));
  // liquido_base = percentual - desconto (só a receber)
  const valorLiquidoBase = arredondar(valorPercentual.sub(descontoValorReceber));
  // liquido_final = base + saldo anterior
  const valorLiquidoFinal = arredondar(valorLiquidoBase.add(saldoAnterior));

  const pctExibicao = percentual.mul(100).toFixed(2).replace(/\.?0+$/, '');
  const passos: PassoCalculo[] = [
    {
      descricao: `Partidas jogadas (${input.contadorAtual} − ${input.contadorAnterior})`,
      valor: `${partidasJogadas}`,
    },
  ];
  if (descontoPartidas > 0)
    passos.push({ descricao: 'Desconto de partidas', valor: `−${descontoPartidas}` });
  passos.push({ descricao: 'Partidas consideradas', valor: `${partidasConsideradas}` });
  passos.push({
    descricao: `Valor bruto (${partidasConsideradas} × ${valorPartida.toFixed(2)}${
      acrescimo.isZero() ? '' : ` + ${acrescimo.toFixed(2)}`
    })`,
    valor: valorBruto.toFixed(2),
  });
  passos.push({
    descricao: `Percentual (${pctExibicao}%)`,
    valor: valorPercentual.toFixed(2),
  });
  if (!descontoValorReceber.isZero())
    passos.push({ descricao: 'Desconto no valor', valor: `−${descontoValorReceber.toFixed(2)}` });
  if (!saldoAnterior.isZero())
    passos.push({
      descricao: saldoAnterior.gt(0) ? 'Saldo devedor anterior' : 'Haver anterior',
      valor: saldoAnterior.toFixed(2),
    });
  passos.push({
    descricao:
      input.regra === 'PERCENTUAL_A_PAGAR' ? 'Valor a pagar ao cliente' : 'Valor líquido final',
    valor: valorLiquidoFinal.toFixed(2),
  });

  return {
    regra: input.regra,
    partidasJogadas,
    descontoPartidas,
    partidasConsideradas,
    valorBruto: valorBruto.toFixed(2),
    acrescimo: acrescimo.toFixed(2),
    valorPercentual: valorPercentual.toFixed(2),
    descontoValorReceber: descontoValorReceber.toFixed(2),
    valorLiquidoBase: valorLiquidoBase.toFixed(2),
    saldoDevedorAnterior: saldoAnterior.toFixed(2),
    valorLiquidoFinal: valorLiquidoFinal.toFixed(2),
    passos,
    erros,
  };
}

// ------------------------------------------------------------
// SALDO RESULTANTE (após registrar pagamento)
// ------------------------------------------------------------
/**
 * novo_saldo = valor_liquido_final − valor_recebido_pago
 * Positivo → cliente continua devendo. Negativo → cliente tem haver.
 * Em PERCENTUAL_A_PAGAR a lógica inverte: o valor é devido AO cliente,
 * então saldo = valor_pago − valor_devido (pago a menos = empresa deve).
 */
export function calcularSaldoResultante(
  regra: RegraCobranca,
  valorLiquidoFinal: string,
  valorRecebidoPago: string
): { saldoResultante: string; alerta?: string } {
  const liquido = D(valorLiquidoFinal);
  const pago = D(valorRecebidoPago);

  if (regra === 'PERCENTUAL_A_PAGAR') {
    // empresa paga ao cliente; se pagou menos, fica devendo (haver do cliente = saldo negativo)
    const saldo = arredondar(pago.sub(liquido));
    return {
      saldoResultante: saldo.toFixed(2),
      alerta: pago.lt(liquido)
        ? 'Atenção: valor pago é menor que o devido ao cliente. Confirme se está correto.'
        : undefined,
    };
  }

  const saldo = arredondar(liquido.sub(pago));
  return { saldoResultante: saldo.toFixed(2) };
}

// ------------------------------------------------------------
// STATUS DE PAGAMENTO
// ------------------------------------------------------------
export function determinarStatusPagamento(
  valorLiquidoFinal: string,
  valorRecebidoPago: string
): 'PAGO' | 'PARCIAL' | 'PENDENTE' {
  const liquido = D(valorLiquidoFinal);
  const pago = D(valorRecebidoPago);
  if (pago.lte(0)) return 'PENDENTE';
  if (pago.gte(liquido)) return 'PAGO';
  return 'PARCIAL';
}
