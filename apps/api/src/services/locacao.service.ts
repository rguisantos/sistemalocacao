// apps/api/src/services/locacao.service.ts
import { prisma } from '@locacoes/database';
import { Prisma } from '@prisma/client';
import type { LocacaoCreateInput } from '@locacoes/shared';
import { HttpError } from '../middleware/error';
import { registrarAuditoria } from './audit.service';

export async function criarLocacao(
  usuarioId: string,
  input: LocacaoCreateInput,
  /** UUID gerado no mobile (sync). Torna a criação idempotente. */
  idExterno?: string
) {
  if (idExterno) {
    const existente = await prisma.locacao.findUnique({ where: { id: idExterno } });
    if (existente) return existente; // retry de sync: já criada
  }

  const locacao = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Produto disponível? (sem locação ativa)
    const locacaoAtiva = await tx.locacao.findFirst({
      where: { produtoId: input.produtoId, status: 'ATIVA', isDeleted: false },
    });
    if (locacaoAtiva) {
      throw new HttpError(409, 'Produto já possui locação ativa');
    }

    const endereco = await tx.endereco.findUnique({ where: { id: input.enderecoId } });
    if (!endereco || endereco.clienteId !== input.clienteId) {
      throw new HttpError(400, 'Endereço não pertence ao cliente informado');
    }

    const nova = await tx.locacao.create({
      data: {
        ...(idExterno ? { id: idExterno } : {}),
        produtoId: input.produtoId,
        clienteId: input.clienteId,
        enderecoId: input.enderecoId,
        regra: input.regra,
        frequencia: input.regra === 'VALOR_FIXO' ? input.frequencia : null,
        valorFixo: input.valorFixo ? new Prisma.Decimal(input.valorFixo) : null,
        valorPartida: input.valorPartida ? new Prisma.Decimal(input.valorPartida) : null,
        percentual: input.percentual ? new Prisma.Decimal(input.percentual) : null,
        contadorInicial: input.contadorInicial,
        dataInicio: input.dataInicio ?? new Date(),
        version: BigInt(Date.now()),
      },
    });

    // Spec: contador inicial editado manualmente atualiza o contador do produto
    await tx.produto.update({
      where: { id: input.produtoId },
      data: { contador: input.contadorInicial, version: BigInt(Date.now()) },
    });

    return nova;
  });

  await registrarAuditoria({
    usuarioId,
    acao: 'criar_locacao',
    entidade: 'Locacao',
    entidadeId: locacao.id,
    dadosNovos: input as Record<string, unknown>,
  });
  return locacao;
}

export interface EditarLocacaoInput {
  regra?: 'VALOR_FIXO' | 'PERCENTUAL_A_RECEBER' | 'PERCENTUAL_A_PAGAR';
  frequencia?: 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | null;
  valorFixo?: string | null;
  valorPartida?: string | null;
  percentual?: string | null;
  /** Correção da leitura: atualiza o contador do PRODUTO (exige alterar_contador_locacao) */
  contadorAtual?: number | null;
}

/**
 * Edita regra/valores/contador de uma locação ATIVA.
 * - regra/valores → permissão `editar_regras_locacao`
 * - contador      → permissão `alterar_contador_locacao`
 * Cálculos futuros usam a nova regra. Tudo auditado com antes/depois.
 */
export async function editarLocacao(
  usuarioId: string,
  locacaoId: string,
  input: EditarLocacaoInput,
  permissoes: string[]
) {
  const anterior = await prisma.locacao.findUnique({
    where: { id: locacaoId },
    include: { produto: { select: { id: true, contador: true } } },
  });
  if (!anterior || anterior.isDeleted) throw new HttpError(404, 'Locação não encontrada');
  if (anterior.status !== 'ATIVA') throw new HttpError(400, 'Apenas locações ativas podem ser editadas');

  const mudaRegras =
    input.regra !== undefined || input.frequencia !== undefined ||
    input.valorFixo !== undefined || input.valorPartida !== undefined ||
    input.percentual !== undefined;
  const mudaContador = input.contadorAtual != null;

  if (mudaRegras && !permissoes.includes('editar_regras_locacao')) {
    throw new HttpError(403, 'Sem permissão para editar regras da locação');
  }
  if (mudaContador && !permissoes.includes('alterar_contador_locacao')) {
    throw new HttpError(403, 'Sem permissão para alterar o contador');
  }
  if (!mudaRegras && !mudaContador) {
    throw new HttpError(400, 'Nenhuma alteração informada');
  }

  // Estado final = atual + alterações; valida coerência da regra resultante
  const regraFinal = input.regra ?? anterior.regra;
  const frequenciaFinal = input.frequencia !== undefined ? input.frequencia : anterior.frequencia;
  const valorFixoFinal = input.valorFixo !== undefined ? input.valorFixo : anterior.valorFixo?.toFixed(2) ?? null;
  const valorPartidaFinal = input.valorPartida !== undefined ? input.valorPartida : anterior.valorPartida?.toFixed(4) ?? null;
  const percentualFinal = input.percentual !== undefined ? input.percentual : anterior.percentual?.toFixed(4) ?? null;

  if (regraFinal === 'VALOR_FIXO') {
    if (!frequenciaFinal) throw new HttpError(400, 'Frequência é obrigatória para valor fixo');
    if (!valorFixoFinal) throw new HttpError(400, 'Valor fixo é obrigatório');
  } else {
    if (!valorPartidaFinal) throw new HttpError(400, 'Valor da partida é obrigatório');
    if (!percentualFinal) throw new HttpError(400, 'Percentual é obrigatório');
  }

  const locacao = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const atualizada = await tx.locacao.update({
      where: { id: locacaoId },
      data: {
        ...(mudaRegras
          ? {
              regra: regraFinal,
              frequencia: regraFinal === 'VALOR_FIXO' ? frequenciaFinal : null,
              valorFixo: regraFinal === 'VALOR_FIXO' && valorFixoFinal ? new Prisma.Decimal(valorFixoFinal) : null,
              valorPartida: regraFinal !== 'VALOR_FIXO' && valorPartidaFinal ? new Prisma.Decimal(valorPartidaFinal) : null,
              percentual: regraFinal !== 'VALOR_FIXO' && percentualFinal ? new Prisma.Decimal(percentualFinal) : null,
            }
          : {}),
        version: BigInt(Date.now()),
      },
    });

    if (mudaContador) {
      await tx.produto.update({
        where: { id: anterior.produtoId },
        data: { contador: input.contadorAtual!, version: BigInt(Date.now()) },
      });
    }
    return atualizada;
  });

  await registrarAuditoria({
    usuarioId,
    acao: mudaContador && !mudaRegras ? 'alterar_contador_locacao' : 'editar_regras_locacao',
    entidade: 'Locacao',
    entidadeId: locacaoId,
    dadosAnteriores: {
      regra: anterior.regra, frequencia: anterior.frequencia,
      valorFixo: anterior.valorFixo?.toFixed(2), valorPartida: anterior.valorPartida?.toFixed(4),
      percentual: anterior.percentual?.toFixed(4), contadorProduto: anterior.produto.contador,
    },
    dadosNovos: input as Record<string, unknown>,
  });

  return locacao;
}

/**
 * Finaliza locação. Se há saldo devedor (> 0), cria SaldoDevedorLocacao.
 * tipo DEPOSITO exige depositoId. tipo RELOCACAO apenas finaliza —
 * a nova locação é criada em seguida via criarLocacao.
 */
export async function finalizarLocacao(
  usuarioId: string,
  locacaoId: string,
  tipo: 'DEPOSITO' | 'RELOCACAO',
  depositoId?: string | null
) {
  if (tipo === 'DEPOSITO' && !depositoId) {
    throw new HttpError(400, 'Depósito de destino é obrigatório');
  }

  const resultado = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const locacao = await tx.locacao.findUnique({ where: { id: locacaoId } });
    if (!locacao || locacao.isDeleted) throw new HttpError(404, 'Locação não encontrada');
    if (locacao.status !== 'ATIVA') throw new HttpError(400, 'Locação já finalizada');

    if (tipo === 'DEPOSITO') {
      const deposito = await tx.deposito.findUnique({ where: { id: depositoId! } });
      if (!deposito || deposito.isDeleted) throw new HttpError(404, 'Depósito não encontrado');
    }

    const finalizada = await tx.locacao.update({
      where: { id: locacaoId },
      data: {
        status: 'FINALIZADA',
        dataFim: new Date(),
        finalizacaoTipo: tipo,
        depositoId: tipo === 'DEPOSITO' ? depositoId : null,
        version: BigInt(Date.now()),
      },
    });

    // Saldo devedor positivo vira dívida vinculada ao cliente
    let saldoDevedor = null;
    if (locacao.saldoAtual.gt(0)) {
      saldoDevedor = await tx.saldoDevedorLocacao.create({
        data: {
          locacaoId: locacao.id,
          clienteId: locacao.clienteId,
          valorOriginal: locacao.saldoAtual,
          valorRestante: locacao.saldoAtual,
          version: BigInt(Date.now()),
        },
      });
    }

    return { finalizada, saldoDevedor };
  });

  await registrarAuditoria({
    usuarioId,
    acao: `finalizar_locacao_${tipo.toLowerCase()}`,
    entidade: 'Locacao',
    entidadeId: locacaoId,
    dadosNovos: { tipo, depositoId, saldoDevedorCriado: !!resultado.saldoDevedor },
  });

  return resultado;
}

/** Registra pagamento de saldo devedor de locação finalizada */
export async function pagarSaldoDevedor(
  usuarioId: string,
  saldoId: string,
  valor: string,
  formaPagamento: 'DINHEIRO' | 'PIX_MANUAL' | 'CARTAO' | 'PIX_MERCADO_PAGO',
  observacoes?: string | null
) {
  const resultado = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const saldo = await tx.saldoDevedorLocacao.findUnique({ where: { id: saldoId } });
    if (!saldo || saldo.isDeleted) throw new HttpError(404, 'Saldo devedor não encontrado');
    if (saldo.status === 'QUITADO') throw new HttpError(400, 'Saldo já quitado');

    const valorPago = new Prisma.Decimal(valor);
    if (valorPago.lte(0)) throw new HttpError(400, 'Valor deve ser positivo');

    const novoRestante = saldo.valorRestante.sub(valorPago);
    const quitado = novoRestante.lte(0);

    const pagamento = await tx.pagamentoSaldo.create({
      data: { saldoId, usuarioId, valor: valorPago, formaPagamento, observacoes },
    });

    const atualizado = await tx.saldoDevedorLocacao.update({
      where: { id: saldoId },
      data: {
        valorRestante: quitado ? new Prisma.Decimal(0) : novoRestante,
        status: quitado ? 'QUITADO' : 'PENDENTE',
        dataQuitacao: quitado ? new Date() : null,
        version: BigInt(Date.now()),
      },
    });

    return { pagamento, saldo: atualizado };
  });

  await registrarAuditoria({
    usuarioId,
    acao: 'pagar_saldo_devedor',
    entidade: 'SaldoDevedorLocacao',
    entidadeId: saldoId,
    dadosNovos: { valor, formaPagamento },
  });

  return resultado;
}
