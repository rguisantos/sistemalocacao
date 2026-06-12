// apps/api/src/services/cobranca.service.ts
import { prisma, Prisma } from '@locacoes/database';
import {
  calcularValorFixo,
  calcularPercentual,
  calcularSaldoResultante,
  determinarStatusPagamento,
  type CobrancaCreateInput,
} from '@locacoes/shared';
import { HttpError } from '../middleware/error';
import { registrarAuditoria } from './audit.service';

/**
 * Pré-calcula a cobrança (endpoint "Calcular" — não persiste nada).
 */
export async function preverCobranca(locacaoId: string, params: {
  contadorAtual?: number | null;
  descontoPartidas?: number;
  acrescimo?: string;
  descontoValorReceber?: string;
}) {
  const locacao = await prisma.locacao.findUnique({
    where: { id: locacaoId },
    include: {
      cobrancas: { orderBy: { dataCobranca: 'desc' }, take: 1, where: { isDeleted: false } },
    },
  });
  if (!locacao || locacao.isDeleted) throw new HttpError(404, 'Locação não encontrada');
  if (locacao.status !== 'ATIVA') throw new HttpError(400, 'Locação não está ativa');

  const ultimaCobranca = locacao.cobrancas[0] ?? null;
  const saldoAnterior = locacao.saldoAtual.toFixed(2);

  if (locacao.regra === 'VALOR_FIXO') {
    return calcularValorFixo({
      frequencia: locacao.frequencia!,
      valorFixo: locacao.valorFixo!.toFixed(2),
      dataReferencia: ultimaCobranca?.dataCobranca ?? locacao.dataInicio,
      dataAtual: new Date(),
      acrescimo: params.acrescimo,
      saldoDevedorAnterior: saldoAnterior,
    });
  }

  if (params.contadorAtual == null) {
    throw new HttpError(400, 'Contador atual é obrigatório para regra percentual');
  }
  const contadorAnterior = ultimaCobranca?.contadorAtual ?? locacao.contadorInicial;

  return calcularPercentual({
    regra: locacao.regra,
    contadorAnterior,
    contadorAtual: params.contadorAtual,
    valorPartida: locacao.valorPartida!.toFixed(4),
    percentual: locacao.percentual!.toFixed(4),
    descontoPartidas: params.descontoPartidas,
    acrescimo: params.acrescimo,
    descontoValorReceber: params.descontoValorReceber,
    saldoDevedorAnterior: saldoAnterior,
  });
}

/**
 * Registra a cobrança de forma TRANSACIONAL:
 * cobrança + saldo da locação + contador do produto, tudo ou nada.
 * Idempotente via syncOrigemId (evita duplicação no retry de sync).
 */
export async function registrarCobranca(
  usuarioId: string,
  input: CobrancaCreateInput,
  reqInfo?: { ip?: string }
) {
  // Idempotência: cobrança vinda do mobile com mesmo syncOrigemId já aplicada?
  if (input.syncOrigemId) {
    const existente = await prisma.cobranca.findFirst({
      where: { syncOrigemId: input.syncOrigemId },
    });
    if (existente) return { cobranca: existente, duplicada: true };
  }

  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx) => {
    const locacao = await tx.locacao.findUnique({
      where: { id: input.locacaoId },
      include: {
        cobrancas: { orderBy: { dataCobranca: 'desc' }, take: 1, where: { isDeleted: false } },
        produto: true,
      },
    });
    if (!locacao || locacao.isDeleted) throw new HttpError(404, 'Locação não encontrada');
    if (locacao.status !== 'ATIVA') throw new HttpError(400, 'Locação não está ativa');

    const ultimaCobranca = locacao.cobrancas[0] ?? null;
    const saldoAnterior = locacao.saldoAtual.toFixed(2);

    let calc: ReturnType<typeof calcularValorFixo> | ReturnType<typeof calcularPercentual>;
    let contadorAnterior: number | null = null;

    if (locacao.regra === 'VALOR_FIXO') {
      calc = calcularValorFixo({
        frequencia: locacao.frequencia!,
        valorFixo: locacao.valorFixo!.toFixed(2),
        dataReferencia: ultimaCobranca?.dataCobranca ?? locacao.dataInicio,
        dataAtual: input.dataCobranca ?? new Date(),
        acrescimo: input.acrescimo,
        saldoDevedorAnterior: saldoAnterior,
      });
    } else {
      if (input.contadorAtual == null) {
        throw new HttpError(400, 'Contador atual é obrigatório para regra percentual');
      }
      contadorAnterior = ultimaCobranca?.contadorAtual ?? locacao.contadorInicial;
      const calcPct = calcularPercentual({
        regra: locacao.regra,
        contadorAnterior,
        contadorAtual: input.contadorAtual,
        valorPartida: locacao.valorPartida!.toFixed(4),
        percentual: locacao.percentual!.toFixed(4),
        descontoPartidas: input.descontoPartidas,
        acrescimo: input.acrescimo,
        descontoValorReceber: input.descontoValorReceber,
        saldoDevedorAnterior: saldoAnterior,
      });
      if (calcPct.erros.length > 0) {
        throw new HttpError(400, 'Erro no cálculo da cobrança', calcPct.erros);
      }
      calc = calcPct;
    }

    const { saldoResultante, alerta } = calcularSaldoResultante(
      locacao.regra,
      calc.valorLiquidoFinal,
      input.valorRecebidoPago
    );
    const statusPagamento = determinarStatusPagamento(
      calc.valorLiquidoFinal,
      input.valorRecebidoPago
    );

    const ehPercentual = locacao.regra !== 'VALOR_FIXO';
    const calcPct = ehPercentual ? (calc as ReturnType<typeof calcularPercentual>) : null;

    const cobranca = await tx.cobranca.create({
      data: {
        locacaoId: locacao.id,
        usuarioId,
        dataCobranca: input.dataCobranca ?? new Date(),
        contadorAnterior,
        contadorAtual: ehPercentual ? input.contadorAtual : null,
        partidasJogadas: calcPct?.partidasJogadas ?? null,
        descontoPartidas: calcPct?.descontoPartidas ?? 0,
        partidasConsideradas: calcPct?.partidasConsideradas ?? null,
        valorBruto: new Prisma.Decimal(calc.valorBruto),
        acrescimo: new Prisma.Decimal(calc.acrescimo),
        valorPercentual: calcPct ? new Prisma.Decimal(calcPct.valorPercentual) : null,
        descontoValorReceber: new Prisma.Decimal(calcPct?.descontoValorReceber ?? '0'),
        valorLiquidoBase: new Prisma.Decimal(calc.valorLiquidoBase),
        saldoDevedorAnterior: new Prisma.Decimal(calc.saldoDevedorAnterior),
        valorLiquidoFinal: new Prisma.Decimal(calc.valorLiquidoFinal),
        valorRecebidoPago: new Prisma.Decimal(input.valorRecebidoPago),
        saldoResultante: new Prisma.Decimal(saldoResultante),
        formaPagamento: input.formaPagamento,
        statusPagamento:
          input.formaPagamento === 'PIX_MERCADO_PAGO' ? 'PENDENTE' : statusPagamento,
        trocaPano: input.trocaPano,
        observacoes: input.observacoes,
        syncOrigemId: input.syncOrigemId,
        version: BigInt(Date.now()),
      },
    });

    // Atualiza saldo da locação
    await tx.locacao.update({
      where: { id: locacao.id },
      data: {
        saldoAtual: new Prisma.Decimal(saldoResultante),
        version: BigInt(Date.now()),
      },
    });

    // Atualiza contador do produto (apenas percentual)
    if (ehPercentual && input.contadorAtual != null) {
      await tx.produto.update({
        where: { id: locacao.produtoId },
        data: { contador: input.contadorAtual, version: BigInt(Date.now()) },
      });
    }

    return { cobranca, calc, alerta };
    });
  } catch (e: any) {
    // Corrida: outro push criou a mesma cobrança entre o check e o create.
    // O índice único em syncOrigemId garante que só uma vence.
    if (e?.code === 'P2002' && input.syncOrigemId) {
      const existente = await prisma.cobranca.findUnique({
        where: { syncOrigemId: input.syncOrigemId },
      });
      if (existente) return { cobranca: existente, duplicada: true };
    }
    throw e;
  }

  await registrarAuditoria({
    usuarioId,
    acao: 'registrar_cobranca',
    entidade: 'Cobranca',
    entidadeId: resultado.cobranca.id,
    dadosNovos: {
      locacaoId: input.locacaoId,
      valorLiquidoFinal: resultado.calc.valorLiquidoFinal,
      valorRecebidoPago: input.valorRecebidoPago,
      formaPagamento: input.formaPagamento,
      ip: reqInfo?.ip,
    },
  });

  return { ...resultado, duplicada: false };
}
