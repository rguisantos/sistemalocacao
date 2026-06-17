import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaldoService } from '../cobrancas/saldo.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';
import { UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';
import { PagarSaldoDto } from './dto/pagar-saldo.dto';

/**
 * Aba de saldo devedor de locações finalizadas.
 * Pagamento direto, append-only; quando o restante zera, o registro fica QUITADO
 * (a aba some no mobile, que filtra por status PENDENTE e valorRestante > 0).
 */
@Injectable()
export class SaldoDevedorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly saldo: SaldoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  listarPendentesDoCliente(clienteId: string) {
    return this.prisma.saldoDevedorLocacao.findMany({
      where: { clienteId, status: 'PENDENTE', valorRestante: { gt: 0 }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async pagar(u: UsuarioRequisicao, saldoId: string, dto: PagarSaldoDto, ip?: string) {
    // Idempotência do pagamento.
    if (dto.pagamentoId) {
      const existente = await this.prisma.pagamento.findUnique({ where: { id: dto.pagamentoId } });
      if (existente) {
        const s = await this.prisma.saldoDevedorLocacao.findUnique({ where: { id: saldoId } });
        return { saldo: s, idempotente: true };
      }
    }

    const saldo = await this.prisma.saldoDevedorLocacao.findFirst({ where: { id: saldoId, deletedAt: null } });
    if (!saldo) throw new NotFoundException('Saldo devedor não encontrado.');
    if (saldo.status === 'QUITADO') throw new BadRequestException('Saldo já quitado.');

    const resultado = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.pagamento.create({
        data: {
          id: dto.pagamentoId, alvo: 'SALDO_DEVEDOR_LOCACAO', saldoId,
          usuarioId: u.id, valor: dto.valor.toFixed(2),
          formaPagamento: dto.formaPagamento, pixId: dto.pixId, dataPagamento: new Date(),
        },
      });
      const restante = await this.saldo.recalcularSaldoDevedor(tx, saldoId);
      return tx.saldoDevedorLocacao.findUnique({ where: { id: saldoId } }).then((s) => ({ s, restante }));
    });

    await this.auditoria.registrar({
      usuarioId: u.id, acao: 'PAGAR_SALDO_DEVEDOR', entidade: 'SaldoDevedorLocacao',
      entidadeId: saldoId, dadosNovos: resultado.s, ip,
    });
    return { saldo: resultado.s };
  }
}
