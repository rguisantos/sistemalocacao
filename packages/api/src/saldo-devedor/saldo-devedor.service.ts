import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recalcularSaldoLocacao } from '@app/core/server';
import { PrismaService } from '../prisma/prisma.service';
import { SaldoService } from '../cobrancas/saldo.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';
import { UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';
import { PagarSaldoDto } from './dto/pagar-saldo.dto';

interface ListarSaldosFiltros {
  clienteId?: string;
  status?: string;
  pagina?: number;
  limite?: number;
}

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

  async listar(filtros: ListarSaldosFiltros) {
    const { clienteId, status, pagina = 1, limite = 20 } = filtros;
    const where: Prisma.SaldoDevedorLocacaoWhereInput = { deletedAt: null };
    if (clienteId) where.clienteId = clienteId;
    if (status) where.status = status as any;

    const [itens, total] = await Promise.all([
      this.prisma.saldoDevedorLocacao.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true, telefones: true } },
          locacao: { select: { id: true, produto: { select: { plaqueta: true } } } },
          pagamentos: { where: { deletedAt: null, estornadoPorId: null }, orderBy: { dataPagamento: 'desc' } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      this.prisma.saldoDevedorLocacao.count({ where }),
    ]);

    return { itens, total, pagina, limite };
  }

  async obter(id: string) {
    const saldo = await this.prisma.saldoDevedorLocacao.findFirst({
      where: { id, deletedAt: null },
      include: {
        cliente: { select: { id: true, nome: true, telefones: true } },
        locacao: { select: { id: true, dataInicio: true, dataFim: true, produto: { select: { id: true, plaqueta: true, descricao: true } } } },
        pagamentos: { where: { deletedAt: null, estornadoPorId: null }, orderBy: { dataPagamento: 'desc' } },
      },
    });
    if (!saldo) throw new NotFoundException('Saldo devedor não encontrado.');
    return saldo;
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
