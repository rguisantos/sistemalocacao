import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recalcularSaldoLocacao } from '@app/core/server';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Derivação do saldo (decisão da auditoria — P0).
 * O saldo é SEMPRE recalculado do histórico append-only, nunca confiado do
 * cliente: saldo = Σ (valorLiquidoBase das cobranças) − Σ (pagamentos válidos).
 */
@Injectable()
export class SaldoService {
  constructor(private readonly prisma: PrismaService) {}

  async recalcularLocacao(tx: Prisma.TransactionClient, locacaoId: string): Promise<string> {
    const cobrancas = await tx.cobranca.findMany({
      where: { locacaoId, deletedAt: null },
      select: { valorLiquidoBase: true },
    });
    const pagamentos = await tx.pagamento.findMany({
      where: { deletedAt: null, estornadoPorId: null, cobranca: { locacaoId } },
      select: { valor: true },
    });

    const bases = cobrancas.map((c) => c.valorLiquidoBase.toString());
    const pagos = pagamentos.map((p) => p.valor.toString());
    const saldo = recalcularSaldoLocacao(bases, pagos).toFixed(2);

    await tx.locacao.update({ where: { id: locacaoId }, data: { saldoDevedorAtual: saldo } });
    return saldo;
  }

  /**
   * Recalcula o valor restante de um SaldoDevedorLocacao (aba de saldo devedor).
   * restante = valorOriginal − Σ pagamentos (append-only). Zerou => QUITADO.
   */
  async recalcularSaldoDevedor(tx: Prisma.TransactionClient, saldoId: string): Promise<string> {
    const saldo = await tx.saldoDevedorLocacao.findUniqueOrThrow({ where: { id: saldoId } });
    const pagamentos = await tx.pagamento.findMany({
      where: { saldoId, deletedAt: null, estornadoPorId: null },
      select: { valor: true },
    });
    const restanteDec = recalcularSaldoLocacao(
      [saldo.valorOriginal.toString()],
      pagamentos.map((p) => p.valor.toString()),
    );
    // não deixa restante negativo (eventual excedente não vira haver aqui)
    const restante = restanteDec.isNegative() ? '0.00' : restanteDec.toFixed(2);
    const quitado = restanteDec.lessThanOrEqualTo(0);
    await tx.saldoDevedorLocacao.update({
      where: { id: saldoId },
      data: {
        valorRestante: restante,
        status: quitado ? 'QUITADO' : 'PENDENTE',
        dataQuitacao: quitado ? new Date() : null,
      },
    });
    return restante;
  }
}
