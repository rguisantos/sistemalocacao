// Registra cobrança LOCALMENTE usando o MESMO engine de cálculo do servidor.
// O servidor recalcula no push; como o engine é compartilhado, os valores batem.
import {
  calcularValorFixo,
  calcularPercentual,
  calcularSaldoResultante,
  type ResultadoValorFixo,
  type ResultadoPercentual,
} from '@locacoes/shared';
import { db } from '../db/schema';
import { uuid } from './sync';

export interface LocacaoLocal {
  id: string;
  regra: 'VALOR_FIXO' | 'PERCENTUAL_A_RECEBER' | 'PERCENTUAL_A_PAGAR';
  frequencia: 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | null;
  valor_fixo: string | null;
  valor_partida: string | null;
  percentual: string | null;
  contador_inicial: number;
  ultimo_contador: number | null;
  ultima_cobranca_data: string | null;
  data_inicio: string;
  saldo_atual: string;
  produto_id: string;
}

export interface ParametrosCobranca {
  contadorAtual?: number;
  descontoPartidas?: number;
  acrescimo?: string;
  descontoValorReceber?: string;
}

export function calcularPrevia(
  locacao: LocacaoLocal,
  params: ParametrosCobranca
): ResultadoValorFixo | ResultadoPercentual {
  if (locacao.regra === 'VALOR_FIXO') {
    return calcularValorFixo({
      frequencia: locacao.frequencia!,
      valorFixo: locacao.valor_fixo!,
      dataReferencia: new Date(locacao.ultima_cobranca_data ?? locacao.data_inicio),
      dataAtual: new Date(),
      acrescimo: params.acrescimo,
      saldoDevedorAnterior: locacao.saldo_atual,
    });
  }
  return calcularPercentual({
    regra: locacao.regra,
    contadorAnterior: locacao.ultimo_contador ?? locacao.contador_inicial,
    contadorAtual: params.contadorAtual ?? 0,
    valorPartida: locacao.valor_partida!,
    percentual: locacao.percentual!,
    descontoPartidas: params.descontoPartidas,
    acrescimo: params.acrescimo,
    descontoValorReceber: params.descontoValorReceber,
    saldoDevedorAnterior: locacao.saldo_atual,
  });
}

export function registrarCobrancaLocal(
  locacao: LocacaoLocal,
  usuarioId: string,
  params: ParametrosCobranca & {
    valorRecebidoPago: string;
    formaPagamento: string;
    trocaPano?: boolean;
    observacoes?: string;
  }
): { id: string; valorLiquidoFinal: string; saldoResultante: string; alerta?: string } {
  const calc = calcularPrevia(locacao, params);
  if ('erros' in calc && calc.erros.length > 0) {
    throw new Error(calc.erros.join(' '));
  }

  const { saldoResultante, alerta } = calcularSaldoResultante(
    locacao.regra,
    calc.valorLiquidoFinal,
    params.valorRecebidoPago
  );

  const id = uuid();
  const agora = Date.now();
  const dataISO = new Date().toISOString();

  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO cobrancas
       (id, locacao_id, usuario_id, data_cobranca, contador_anterior, contador_atual,
        desconto_partidas, acrescimo, desconto_valor_receber, valor_liquido_final,
        valor_recebido_pago, saldo_resultante, forma_pagamento, troca_pano, observacoes,
        sync_status, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_CREATE', ?)`,
      [
        id, locacao.id, usuarioId, dataISO,
        locacao.ultimo_contador ?? locacao.contador_inicial,
        params.contadorAtual ?? null,
        params.descontoPartidas ?? 0,
        params.acrescimo ?? '0',
        params.descontoValorReceber ?? '0',
        calc.valorLiquidoFinal,
        params.valorRecebidoPago,
        saldoResultante,
        params.formaPagamento,
        params.trocaPano ? 1 : 0,
        params.observacoes ?? null,
        agora,
      ]
    );

    db.runSync(
      `UPDATE locacoes SET saldo_atual = ?, ultimo_contador = COALESCE(?, ultimo_contador),
       ultima_cobranca_data = ?, version = ? WHERE id = ?`,
      [saldoResultante, params.contadorAtual ?? null, dataISO, agora, locacao.id]
    );

    if (params.contadorAtual != null) {
      db.runSync(`UPDATE produtos SET contador = ?, version = ? WHERE id = ?`, [
        params.contadorAtual, agora, locacao.produto_id,
      ]);
    }
  });

  return { id, valorLiquidoFinal: calc.valorLiquidoFinal, saldoResultante, alerta };
}
