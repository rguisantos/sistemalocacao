import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  calcularValorFixo, calcularPercentual, aplicarPagamento, menorQue,
} from '@app/core/server';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';
import { SaldoService } from './saldo.service';
import { UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';
import { RegistrarCobrancaDto } from './dto/registrar-cobranca.dto';

interface ListarCobrancasFiltros {
  clienteId?: string;
  locacaoId?: string;
  statusPagamento?: string;
  dataInicio?: Date;
  dataFim?: Date;
  pagina?: number;
  limite?: number;
}

interface ResumoFiltros {
  clienteId?: string;
  dataInicio?: Date;
  dataFim?: Date;
}

@Injectable()
export class CobrancasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly saldo: SaldoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /* ─── LISTAGEM COM FILTROS E PAGINAÇÃO ─── */
  async listar(filtros: ListarCobrancasFiltros) {
    const { clienteId, locacaoId, statusPagamento, dataInicio, dataFim, pagina = 1, limite = 20 } = filtros;
    const where: Prisma.CobrancaWhereInput = { deletedAt: null };

    if (statusPagamento) where.statusPagamento = statusPagamento as any;
    if (locacaoId) where.locacaoId = locacaoId;
    if (dataInicio || dataFim) {
      where.dataCobranca = {};
      if (dataInicio) (where.dataCobranca as any).gte = dataInicio;
      if (dataFim) (where.dataCobranca as any).lte = dataFim;
    }
    if (clienteId) {
      where.locacao = { clienteId };
    }

    const [itens, total] = await Promise.all([
      this.prisma.cobranca.findMany({
        where,
        include: {
          locacao: { include: { cliente: { select: { id: true, nome: true } }, produto: { select: { id: true, plaqueta: true, descricao: true } } } },
          usuario: { select: { id: true, nome: true } },
          pagamentos: { where: { deletedAt: null, estornadoPorId: null }, select: { id: true, valor: true, formaPagamento: true, dataPagamento: true } },
        },
        orderBy: { dataCobranca: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      this.prisma.cobranca.count({ where }),
    ]);

    return { itens, total, pagina, limite };
  }

  /* ─── DETALHE COM MEMORIAL E PAGAMENTOS ─── */
  async obter(id: string) {
    const cobranca = await this.prisma.cobranca.findFirst({
      where: { id, deletedAt: null },
      include: {
        locacao: {
          include: {
            cliente: { select: { id: true, nome: true, telefones: true } },
            produto: { select: { id: true, plaqueta: true, descricao: true } },
            endereco: { select: { id: true, logradouro: true, numero: true, bairro: true, cidade: true } },
          },
        },
        usuario: { select: { id: true, nome: true } },
        pagamentos: { where: { deletedAt: null, estornadoPorId: null }, orderBy: { dataPagamento: 'desc' } },
        manutencoes: { where: { deletedAt: null } },
      },
    });
    if (!cobranca) throw new NotFoundException('Cobrança não encontrada.');

    // Reconstrói o memorial a partir dos campos snapshot
    const memorial = this.reconstruirMemorial(cobranca);

    // Cobranças anteriores da mesma locação (histórico)
    const historicoLocacao = await this.prisma.cobranca.findMany({
      where: { locacaoId: cobranca.locacaoId, deletedAt: null, id: { not: id } },
      select: {
        id: true, dataCobranca: true, valorLiquidoFinal: true,
        statusPagamento: true, regraSnapshot: true,
      },
      orderBy: { dataCobranca: 'desc' },
      take: 10,
    });

    return { cobranca, memorial, historicoLocacao };
  }

  /* ─── RESUMO FINANCEIRO ─── */
  async resumo(filtros: ResumoFiltros) {
    const { clienteId, dataInicio, dataFim } = filtros;
    const whereCobranca: Prisma.CobrancaWhereInput = { deletedAt: null };
    const wherePagamento: Prisma.PagamentoWhereInput = { deletedAt: null, estornadoPorId: null };

    if (dataInicio || dataFim) {
      const filtroData: any = {};
      if (dataInicio) filtroData.gte = dataInicio;
      if (dataFim) filtroData.lte = dataFim;
      whereCobranca.dataCobranca = filtroData;
      wherePagamento.dataPagamento = filtroData;
    }
    if (clienteId) {
      whereCobranca.locacao = { clienteId };
      wherePagamento.cobranca = { locacao: { clienteId } };
    }

    // Totais por status
    const [pendentes, parciais, pagas] = await Promise.all([
      this.prisma.cobranca.aggregate({ where: { ...whereCobranca, statusPagamento: 'PENDENTE' }, _sum: { valorLiquidoFinal: true }, _count: true }),
      this.prisma.cobranca.aggregate({ where: { ...whereCobranca, statusPagamento: 'PARCIAL' }, _sum: { valorLiquidoFinal: true }, _count: true }),
      this.prisma.cobranca.aggregate({ where: { ...whereCobranca, statusPagamento: 'PAGO' }, _sum: { valorLiquidoFinal: true }, _count: true }),
    ]);

    // Total recebido (pagamentos)
    const totalRecebido = await this.prisma.pagamento.aggregate({
      where: wherePagamento,
      _sum: { valor: true },
    });

    // Por forma de pagamento
    const porForma = await this.prisma.pagamento.groupBy({
      by: ['formaPagamento'],
      where: wherePagamento,
      _sum: { valor: true },
      _count: true,
    });

    // Evolução mensal (últimos 12 meses)
    const hoje = new Date();
    const dozeMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
    const cobrancasPorMes = await this.prisma.cobranca.findMany({
      where: { ...whereCobranca, dataCobranca: { gte: dozeMesesAtras } },
      select: { dataCobranca: true, valorLiquidoFinal: true, statusPagamento: true },
      orderBy: { dataCobranca: 'asc' },
    });

    const pagamentosPorMes = await this.prisma.pagamento.findMany({
      where: { ...wherePagamento, dataPagamento: { gte: dozeMesesAtras } },
      select: { dataPagamento: true, valor: true },
      orderBy: { dataPagamento: 'asc' },
    });

    // Agrupamento mensal
    const meses: Record<string, { cobrado: number; recebido: number }> = {};
    for (const c of cobrancasPorMes) {
      const chave = c.dataCobranca.toISOString().slice(0, 7);
      if (!meses[chave]) meses[chave] = { cobrado: 0, recebido: 0 };
      meses[chave].cobrado += Number(c.valorLiquidoFinal);
    }
    for (const p of pagamentosPorMes) {
      const chave = p.dataPagamento.toISOString().slice(0, 7);
      if (!meses[chave]) meses[chave] = { cobrado: 0, recebido: 0 };
      meses[chave].recebido += Number(p.valor);
    }
    const evolucaoMensal = Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, vals]) => ({ mes, ...vals }));

    return {
      totais: {
        pendente: { valor: pendentes._sum.valorLiquidoFinal ?? 0, count: pendentes._count },
        parcial: { valor: parciais._sum.valorLiquidoFinal ?? 0, count: parciais._count },
        pago: { valor: pagas._sum.valorLiquidoFinal ?? 0, count: pagas._count },
        totalRecebido: totalRecebido._sum.valor ?? 0,
      },
      porForma: porForma.map((f) => ({
        forma: f.formaPagamento,
        valor: f._sum.valor ?? 0,
        count: f._count,
      })),
      evolucaoMensal,
    };
  }

  /* ─── REGISTRAR COBRANÇA (EXISTENTE) ─── */
  async registrar(u: UsuarioRequisicao, dto: RegistrarCobrancaDto, ip?: string) {
    // Idempotência: se o id do cliente já existe, devolve a cobrança existente.
    if (dto.id) {
      const existente = await this.prisma.cobranca.findUnique({ where: { id: dto.id } });
      if (existente) return { cobranca: existente, idempotente: true };
    }

    const locacao = await this.prisma.locacao.findFirst({
      where: { id: dto.locacaoId, deletedAt: null }, include: { produto: true },
    });
    if (!locacao) throw new NotFoundException('Locação não encontrada.');
    if (locacao.status === 'FINALIZADA') throw new BadRequestException('Locação finalizada não pode ser cobrada.');

    const ultima = await this.prisma.cobranca.findFirst({
      where: { locacaoId: locacao.id, deletedAt: null }, orderBy: { dataCobranca: 'desc' },
    });
    const dataReferencia = ultima?.dataCobranca ?? locacao.dataInicio;
    const contadorAnterior = ultima?.contadorAtual ?? locacao.contadorInicial;
    const saldoAnterior = locacao.saldoDevedorAtual.toString();
    const hoje = dto.dataCobranca ? new Date(dto.dataCobranca) : new Date();
    const acrescimo = dto.acrescimo ?? 0;

    // ---- cálculo via @app/core ----
    let calc: ReturnType<typeof calcularValorFixo> | ReturnType<typeof calcularPercentual>;
    let dadosPercentual: { contadorAtual: number; partidasJogadas: number; partidasConsideradas: number } | null = null;

    if (locacao.regra === 'VALOR_FIXO') {
      calc = calcularValorFixo({
        valorFixo: locacao.valorFixo!.toString(),
        frequencia: locacao.frequencia as any,
        dataReferencia, hoje, acrescimo, saldoAnterior,
      });
    } else {
      if (dto.contadorAtual == null) throw new BadRequestException('Informe o contador atual.');
      const r = calcularPercentual({
        regra: locacao.regra as any,
        contadorAnterior,
        contadorAtual: dto.contadorAtual,
        contadorReiniciado: dto.contadorReiniciado,
        valorPartida: locacao.valorPartida!.toString(),
        percentual: locacao.percentual!.toString(),
        descontoPartidas: dto.descontoPartidas,
        acrescimo,
        descontoValorReceber: dto.descontoValorReceber,
        saldoAnterior,
      });
      calc = r;
      dadosPercentual = { contadorAtual: dto.contadorAtual, partidasJogadas: r.partidasJogadas, partidasConsideradas: r.partidasConsideradas };
    }

    const valorPago = dto.pagamento?.valor ?? 0;
    const { alertaPagamentoInferior } = aplicarPagamento(locacao.regra as any, calc.valorLiquidoFinal.toString(), valorPago);

    const statusPagamento = valorPago <= 0
      ? 'PENDENTE'
      : (menorQue(valorPago, calc.valorLiquidoFinal.toString()) ? 'PARCIAL' : 'PAGO');

    const podeTrocaPano = u.permissoes.includes('cobrancas.marcar_troca_pano');
    const trocaPano = !!dto.trocaPano && podeTrocaPano;

    // ---- persistência transacional ----
    const resultado = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const cobranca = await tx.cobranca.create({
        data: {
          id: dto.id,                                    // idempotência por UUID do cliente
          locacaoId: locacao.id,
          usuarioId: u.id,
          dataCobranca: hoje,
          regraSnapshot: locacao.regra,                  // [AUDIT P1] snapshot reproduzível
          regraVersaoSnapshot: locacao.regraVersao,
          contadorAnterior: dadosPercentual ? contadorAnterior : null,
          contadorAtual: dadosPercentual?.contadorAtual ?? null,
          contadorReiniciado: !!dto.contadorReiniciado,
          partidasJogadas: dadosPercentual?.partidasJogadas ?? null,
          descontoPartidas: dto.descontoPartidas ?? 0,
          partidasConsideradas: dadosPercentual?.partidasConsideradas ?? null,
          acrescimo: Number(acrescimo).toFixed(2),
          valorBruto: calc.valorBruto?.toFixed(2) ?? null,
          valorPercentual: calc.valorPercentual?.toFixed(2) ?? null,
          descontoValorReceber: (dto.descontoValorReceber ?? 0).toFixed(2),
          valorLiquidoBase: calc.valorLiquidoBase.toFixed(2),
          saldoDevedorAnterior: calc.saldoDevedorAnterior.toFixed(2),
          valorLiquidoFinal: calc.valorLiquidoFinal.toFixed(2),
          trocaPano,
          statusPagamento,
        },
      });

      // Pagamento append-only (decisão da auditoria — P0)
      if (dto.pagamento && valorPago > 0) {
        await tx.pagamento.create({
          data: {
            alvo: 'COBRANCA', cobrancaId: cobranca.id, usuarioId: u.id,
            valor: valorPago.toFixed(2), formaPagamento: dto.pagamento.formaPagamento,
            pixId: dto.pagamento.pixId, dataPagamento: hoje,
          },
        });
      }

      // Troca de pano gera manutenção vinculada (seção 11 da spec)
      if (trocaPano) {
        await tx.manutencao.create({
          data: { produtoId: locacao.produtoId, cobrancaId: cobranca.id, usuarioId: u.id, tipo: 'TROCA_PANO', data: hoje },
        });
      }

      // Atualiza o contador do produto (percentual)
      if (dadosPercentual) {
        await tx.produto.update({ where: { id: locacao.produtoId }, data: { contador: dadosPercentual.contadorAtual } });
      }

      // Saldo derivado do histórico (nunca do cliente)
      const novoSaldo = await this.saldo.recalcularLocacao(tx, locacao.id);
      return { cobranca, novoSaldo };
    });

    await this.auditoria.registrar({
      usuarioId: u.id, acao: 'REGISTRAR_COBRANCA', entidade: 'Cobranca',
      entidadeId: resultado.cobranca.id, dadosNovos: resultado.cobranca, ip,
    });

    return {
      cobranca: resultado.cobranca,
      memorial: calc.memorial,
      saldoAtualizado: resultado.novoSaldo,
      alertaPagamentoInferior,
    };
  }

  /* ─── RECONSTRUIR MEMORIAL A PARTIR DOS CAMPOS SNAPSHOT ─── */
  private reconstruirMemorial(cobranca: any): { rotulo: string; valor: string }[] {
    const linhas: { rotulo: string; valor: string }[] = [];

    if (cobranca.regraSnapshot === 'VALOR_FIXO') {
      linhas.push({ rotulo: 'Regra', valor: 'Valor Fixo' });
    } else {
      linhas.push({ rotulo: 'Regra', valor: cobranca.regraSnapshot.replace(/_/g, ' ') });
      if (cobranca.contadorAnterior != null) linhas.push({ rotulo: 'Contador anterior', valor: cobranca.contadorAnterior });
      if (cobranca.contadorAtual != null) linhas.push({ rotulo: 'Contador atual', valor: cobranca.contadorAtual });
      if (cobranca.partidasJogadas != null) linhas.push({ rotulo: 'Partidas jogadas', valor: cobranca.partidasJogadas });
      if (cobranca.descontoPartidas) linhas.push({ rotulo: 'Desconto partidas', valor: cobranca.descontoPartidas });
      if (cobranca.partidasConsideradas != null) linhas.push({ rotulo: 'Partidas consideradas', valor: cobranca.partidasConsideradas });
    }

    if (cobranca.valorBruto) linhas.push({ rotulo: 'Valor bruto', valor: `R$ ${Number(cobranca.valorBruto).toFixed(2)}` });
    if (cobranca.valorPercentual) linhas.push({ rotulo: 'Valor percentual', valor: `R$ ${Number(cobranca.valorPercentual).toFixed(2)}` });
    if (Number(cobranca.descontoValorReceber) > 0) linhas.push({ rotulo: 'Desconto no valor a receber', valor: `R$ ${Number(cobranca.descontoValorReceber).toFixed(2)}` });
    if (Number(cobranca.acrescimo) > 0) linhas.push({ rotulo: 'Acréscimo', valor: `R$ ${Number(cobranca.acrescimo).toFixed(2)}` });
    linhas.push({ rotulo: 'Saldo devedor anterior', valor: `R$ ${Number(cobranca.saldoDevedorAnterior).toFixed(2)}` });
    linhas.push({ rotulo: 'Valor líquido base', valor: `R$ ${Number(cobranca.valorLiquidoBase).toFixed(2)}` });
    linhas.push({ rotulo: 'Valor líquido final (c/ saldo)', valor: `R$ ${Number(cobranca.valorLiquidoFinal).toFixed(2)}` });

    return linhas;
  }
}
