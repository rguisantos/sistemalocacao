import { v4 as uuid } from 'uuid';
import {
  calcularValorFixo, calcularPercentual, aplicarPagamento, recalcularSaldoLocacao,
} from '@app/core';
import { emTransacao, todos } from '../db/database';
import { ultimaCobranca } from './repositorios';

export interface EntradaCobranca {
  contadorAtual?: number; contadorReiniciado?: boolean;
  descontoPartidas?: number; descontoValorReceber?: number; acrescimo?: number;
  trocaPano?: boolean;
  pagamento?: { valor: number; formaPagamento: string; pixId?: string };
}

/**
 * Registra a cobrança LOCALMENTE (offline-first) reusando o motor @app/core:
 * mesma matemática do servidor, então o cobrador vê o valor correto sem rede.
 * Grava cobrança + pagamento com _syncStatus='created'; o servidor é a fonte
 * da verdade e re-deriva o saldo no próximo sync.
 */
export async function registrarCobrancaLocal(usuarioId: string, locacao: any, e: EntradaCobranca) {
  const ultima: any = await ultimaCobranca(locacao.id);
  const dataReferencia = ultima ? new Date(ultima.dataCobranca) : new Date(locacao.dataInicio);
  const contadorAnterior = ultima?.contadorAtual ?? locacao.contadorInicial ?? 0;
  const saldoAnterior = locacao.saldoDevedorAtual ?? '0';
  const hoje = new Date();

  let calc: any; let dadosPct: any = null;
  if (locacao.regra === 'VALOR_FIXO') {
    calc = calcularValorFixo({ valorFixo: locacao.valorFixo, frequencia: locacao.frequencia, dataReferencia, hoje, acrescimo: e.acrescimo, saldoAnterior });
  } else {
    if (e.contadorAtual == null) throw new Error('Informe o contador atual.');
    calc = calcularPercentual({
      regra: locacao.regra, contadorAnterior, contadorAtual: e.contadorAtual, contadorReiniciado: e.contadorReiniciado,
      valorPartida: locacao.valorPartida, percentual: locacao.percentual,
      descontoPartidas: e.descontoPartidas, acrescimo: e.acrescimo, descontoValorReceber: e.descontoValorReceber, saldoAnterior,
    });
    dadosPct = { contadorAtual: e.contadorAtual, partidasJogadas: calc.partidasJogadas, partidasConsideradas: calc.partidasConsideradas };
  }

  const valorPago = e.pagamento?.valor ?? 0;
  const { alertaPagamentoInferior } = aplicarPagamento(locacao.regra, calc.valorLiquidoFinal.toString(), valorPago);
  const statusPagamento = valorPago <= 0 ? 'PENDENTE' : (valorPago < Number(calc.valorLiquidoFinal.toString()) ? 'PARCIAL' : 'PAGO');

  const cobrancaId = uuid();
  const agora = hoje.toISOString();

  await emTransacao(async (db) => {
    await db.runAsync(
      `INSERT INTO cobranca (id, locacaoId, usuarioId, dataCobranca, regraSnapshot, regraVersaoSnapshot,
        contadorAnterior, contadorAtual, contadorReiniciado, partidasJogadas, descontoPartidas, partidasConsideradas,
        acrescimo, valorBruto, valorPercentual, descontoValorReceber, valorLiquidoBase, saldoDevedorAnterior, valorLiquidoFinal,
        trocaPano, statusPagamento, updatedAt, _syncStatus, _lastModified)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'created',?)`,
      [cobrancaId, locacao.id, usuarioId, agora, locacao.regra, locacao.regraVersao ?? 1,
       dadosPct ? contadorAnterior : null, dadosPct?.contadorAtual ?? null, e.contadorReiniciado ? 1 : 0,
       dadosPct?.partidasJogadas ?? null, e.descontoPartidas ?? 0, dadosPct?.partidasConsideradas ?? null,
       Number(e.acrescimo ?? 0).toFixed(2), calc.valorBruto ? calc.valorBruto.toFixed(2) : null,
       calc.valorPercentual ? calc.valorPercentual.toFixed(2) : null, Number(e.descontoValorReceber ?? 0).toFixed(2),
       calc.valorLiquidoBase.toFixed(2), calc.saldoDevedorAnterior.toFixed(2), calc.valorLiquidoFinal.toFixed(2),
       e.trocaPano ? 1 : 0, statusPagamento, agora, Date.now()],
    );

    if (e.pagamento && valorPago > 0) {
      await db.runAsync(
        `INSERT INTO pagamento (id, alvo, cobrancaId, usuarioId, valor, formaPagamento, pixId, dataPagamento, updatedAt, _syncStatus, _lastModified)
         VALUES (?,?,?,?,?,?,?,?,?,'created',?)`,
        [uuid(), 'COBRANCA', cobrancaId, usuarioId, valorPago.toFixed(2), e.pagamento.formaPagamento, e.pagamento.pixId ?? null, agora, agora, Date.now()],
      );
    }
    if (e.trocaPano) {
      await db.runAsync(
        `INSERT INTO manutencao (id, produtoId, cobrancaId, usuarioId, tipo, data, updatedAt, _syncStatus, _lastModified)
         VALUES (?,?,?,?,?,?,?,'created',?)`,
        [uuid(), locacao.produtoId, cobrancaId, usuarioId, 'TROCA_PANO', agora, agora, Date.now()],
      );
      await db.runAsync(`UPDATE produto SET _syncStatus = CASE _syncStatus WHEN 'synced' THEN 'updated' ELSE _syncStatus END WHERE id = ?`, [locacao.produtoId]);
    }
    if (dadosPct) {
      await db.runAsync(`UPDATE produto SET contador = ?, _syncStatus = CASE _syncStatus WHEN 'synced' THEN 'updated' ELSE _syncStatus END WHERE id = ?`, [dadosPct.contadorAtual, locacao.produtoId]);
    }

    // recalcula saldo local a partir do histórico (espelha o servidor)
    const cobr = await todos<{ valorLiquidoBase: string }>(`SELECT valorLiquidoBase FROM cobranca WHERE locacaoId = ? AND deletedAt IS NULL`, [locacao.id]);
    const pags = await todos<{ valor: string }>(`SELECT p.valor FROM pagamento p JOIN cobranca c ON c.id = p.cobrancaId WHERE c.locacaoId = ? AND p.deletedAt IS NULL`, [locacao.id]);
    const novoSaldo = recalcularSaldoLocacao(cobr.map((c) => c.valorLiquidoBase), pags.map((p) => p.valor)).toFixed(2);
    await db.runAsync(`UPDATE locacao SET saldoDevedorAtual = ? WHERE id = ?`, [novoSaldo, locacao.id]);
  });

  return { cobrancaId, memorial: calc.memorial, valorLiquidoFinal: calc.valorLiquidoFinal.toFixed(2), alertaPagamentoInferior };
}
