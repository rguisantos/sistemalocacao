import { Injectable } from '@nestjs/common';
import { somar } from '@app/core/server';
import { PrismaService } from '../prisma/prisma.service';

/** Agregações para o painel e relatórios. Somas com precisão decimal via @app/core. */
@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  private inicioDoMes(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }

  /** Wrapper seguro para somar() — retorna 0 se não houver valores. */
  private somarSeguro(...valores: string[]): string {
    if (valores.length === 0) return '0';
    return somar(...valores).toFixed(2);
  }

  async dashboard(de?: Date, ate?: Date, rotaId?: string) {
    const desde = de ?? this.inicioDoMes();
    const ateDate = ate ?? new Date();

    // Pagamentos no período (com filtro de rota opcional)
    const wherePag: any = { deletedAt: null, estornadoPorId: null, dataPagamento: { gte: desde, lte: ateDate } };
    if (rotaId) wherePag.cobranca = { locacao: { cliente: { rotaId } } };

    const pagamentosMes = await this.prisma.pagamento.findMany({
      where: wherePag,
      select: { valor: true },
    });
    const faturamentoMes = this.somarSeguro(...pagamentosMes.map((p) => p.valor.toString()));

    // Faturamento do período anterior (mesmo intervalo, deslocado)
    const diff = ateDate.getTime() - desde.getTime();
    const inicioAnterior = new Date(desde.getTime() - diff);
    const wherePagAnt: any = { deletedAt: null, estornadoPorId: null, dataPagamento: { gte: inicioAnterior, lt: desde } };
    if (rotaId) wherePagAnt.cobranca = { locacao: { cliente: { rotaId } } };
    const pagAnterior = await this.prisma.pagamento.findMany({ where: wherePagAnt, select: { valor: true } });
    const faturamentoAnterior = this.somarSeguro(...pagAnterior.map((p) => p.valor.toString()));
    const variacao = Number(faturamentoAnterior) > 0
      ? ((Number(faturamentoMes) - Number(faturamentoAnterior)) / Number(faturamentoAnterior) * 100).toFixed(1)
      : 0;

    // Inadimplência
    const whereLoc: any = { status: 'ATIVA', deletedAt: null };
    if (rotaId) whereLoc.cliente = { rotaId };
    const locacoesComSaldo = await this.prisma.locacao.findMany({
      where: { ...whereLoc, saldoDevedorAtual: { gt: 0 } },
      select: { saldoDevedorAtual: true },
    });
    const whereSaldo: any = { status: 'PENDENTE', deletedAt: null };
    if (rotaId) whereSaldo.cliente = { rotaId };
    const saldosPendentes = await this.prisma.saldoDevedorLocacao.findMany({
      where: whereSaldo, select: { valorRestante: true },
    });
    const inadimplencia = this.somarSeguro(
      ...locacoesComSaldo.map((l) => l.saldoDevedorAtual.toString()),
      ...saldosPendentes.map((s) => s.valorRestante.toString()),
    );

    // Contagens
    const whereCliente: any = { ativo: true, deletedAt: null };
    if (rotaId) whereCliente.rotaId = rotaId;
    const totalClientes = await this.prisma.cliente.count({ where: whereCliente });
    const totalProdutos = await this.prisma.produto.count({ where: { deletedAt: null } });
    const locacoesAtivas = await this.prisma.locacao.count({ where: whereLoc });
    const cobrancasAtrasadas = await this.prisma.cobranca.count({
      where: { statusPagamento: 'PENDENTE', deletedAt: null, dataCobranca: { lt: new Date() } },
    });

    // Faturamento por rota
    const porRota = await this.faturamentoPorRota(desde, ateDate, rotaId);

    // Faturamento por mês (últimos 6 meses)
    const faturamentoMensal = await this.faturamentoPorMes(6, rotaId);

    // Distribuição de status de pagamento
    const statusDist = await this.prisma.cobranca.groupBy({
      by: ['statusPagamento'],
      where: { deletedAt: null },
      _count: { id: true },
    });

    // Top 5 clientes por faturamento
    const topClientes = await this.topClientesPorFaturamento(desde, ateDate, rotaId);

    // Cobranças recentes (8 últimas)
    const cobrancasRecentes = await this.prisma.cobranca.findMany({
      where: { deletedAt: null },
      orderBy: { dataCobranca: 'desc' },
      take: 8,
      select: {
        id: true, dataCobranca: true, statusPagamento: true, valorLiquidoFinal: true,
        locacao: { select: { cliente: { select: { nome: true } }, produto: { select: { plaqueta: true } } } },
      },
    });

    return {
      faturamentoMes: Number(faturamentoMes),
      faturamentoAnterior: Number(faturamentoAnterior),
      variacao: Number(variacao),
      inadimplencia: Number(inadimplencia),
      totalClientes,
      totalProdutos,
      locacoesAtivas,
      cobrancasAtrasadas,
      porRota: porRota.map((r) => ({ rota: r.rota, valor: Number(r.valor) })),
      faturamentoMensal,
      statusDistribuicao: statusDist.map((s) => ({ status: s.statusPagamento, total: (s._count as any).id ?? s._count })),
      topClientes,
      cobrancasRecentes: cobrancasRecentes.map((c) => ({
        id: c.id,
        cliente: c.locacao?.cliente?.nome ?? '—',
        produto: c.locacao?.produto?.plaqueta ?? '—',
        valor: Number(c.valorLiquidoFinal),
        status: c.statusPagamento,
        data: c.dataCobranca,
      })),
    };
  }

  /** Faturamento (pagamentos) por rota no período. */
  async faturamentoPorRota(de: Date, ate: Date, rotaId?: string) {
    const where: any = { deletedAt: null, estornadoPorId: null, cobrancaId: { not: null }, dataPagamento: { gte: de, lte: ate } };
    if (rotaId) where.cobranca = { locacao: { cliente: { rotaId } } };
    const pagamentos = await this.prisma.pagamento.findMany({
      where,
      select: { valor: true, cobranca: { select: { locacao: { select: { cliente: { select: { rota: { select: { nome: true } } } } } } } } },
    });
    const mapa = new Map<string, string[]>();
    for (const p of pagamentos) {
      const rota = p.cobranca?.locacao?.cliente?.rota?.nome ?? 'Sem rota';
      const arr = mapa.get(rota) ?? [];
      arr.push(p.valor.toString());
      mapa.set(rota, arr);
    }
    return [...mapa.entries()].map(([rota, valores]) => ({ rota, valor: this.somarSeguro(...valores) }));
  }

  /** Faturamento agrupado por mês (últimos N meses). */
  async faturamentoPorMes(meses: number, rotaId?: string) {
    const resultado: { mes: string; valor: number }[] = [];
    const agora = new Date();
    for (let i = meses - 1; i >= 0; i--) {
      const inicio = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const fim = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 0, 23, 59, 59);
      const where: any = { deletedAt: null, estornadoPorId: null, dataPagamento: { gte: inicio, lte: fim } };
      if (rotaId) where.cobranca = { locacao: { cliente: { rotaId } } };
      const pags = await this.prisma.pagamento.findMany({ where, select: { valor: true } });
      const total = pags.length > 0 ? Number(this.somarSeguro(...pags.map((p) => p.valor.toString()))) : 0;
      resultado.push({
        mes: inicio.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        valor: total,
      });
    }
    return resultado;
  }

  /** Top 5 clientes por faturamento no período. */
  async topClientesPorFaturamento(de: Date, ate: Date, rotaId?: string) {
    const where: any = { deletedAt: null, estornadoPorId: null, cobrancaId: { not: null }, dataPagamento: { gte: de, lte: ate } };
    if (rotaId) where.cobranca = { locacao: { cliente: { rotaId } } };
    const pags = await this.prisma.pagamento.findMany({
      where,
      select: {
        valor: true,
        cobranca: { select: { locacao: { select: { cliente: { select: { id: true, nome: true } } } } } },
      },
    });
    const mapa = new Map<string, { nome: string; total: string[] }>();
    for (const p of pags) {
      const c = p.cobranca?.locacao?.cliente;
      if (!c) continue;
      const entry = mapa.get(c.id) ?? { nome: c.nome, total: [] };
      entry.total.push(p.valor.toString());
      mapa.set(c.id, entry);
    }
    return [...mapa.entries()]
      .map(([id, v]) => ({ id, nome: v.nome, valor: Number(this.somarSeguro(...v.total)) }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }

  /** Clientes inadimplentes (locações ativas com saldo + saldos finalizados pendentes). */
  async inadimplencia() {
    const ativas = await this.prisma.locacao.findMany({
      where: { status: 'ATIVA', deletedAt: null, saldoDevedorAtual: { gt: 0 } },
      select: { saldoDevedorAtual: true, cliente: { select: { nome: true } } },
    });
    const pendentes = await this.prisma.saldoDevedorLocacao.findMany({
      where: { status: 'PENDENTE', deletedAt: null },
      select: { valorRestante: true, cliente: { select: { nome: true } } },
    });
    return [
      ...ativas.map((a) => ({ cliente: a.cliente.nome, valor: a.saldoDevedorAtual.toString(), origem: 'Locação ativa' })),
      ...pendentes.map((p) => ({ cliente: p.cliente.nome, valor: p.valorRestante.toString(), origem: 'Saldo finalizado' })),
    ];
  }

  /** Relatório de locações (ativas/finalizadas por período). */
  async locacoes(de?: Date, ate?: Date, rotaId?: string) {
    const where: any = { deletedAt: null };
    if (de || ate) {
      where.dataInicio = { ...(de && { gte: de }), ...(ate && { lte: ate }) };
    }
    if (rotaId) where.cliente = { rotaId };

    const ativas = await this.prisma.locacao.count({ where: { ...where, status: 'ATIVA' } });
    const finalizadas = await this.prisma.locacao.count({ where: { ...where, status: 'FINALIZADA' } });
    const porRota = await this.prisma.locacao.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    return { ativas, finalizadas, porStatus: porRota.map((r) => ({ status: r.status, total: (r._count as any).id ?? r._count })) };
  }

  /** Relatório de produtos (locados/disponíveis). */
  async produtos() {
    const total = await this.prisma.produto.count({ where: { deletedAt: null } });
    const locados = await this.prisma.locacao.count({ where: { status: 'ATIVA', deletedAt: null } });
    const porTipo = await this.prisma.produto.groupBy({
      by: ['tipoId'],
      where: { deletedAt: null },
      _count: { id: true },
    });
    const tipos = await this.prisma.tipoProduto.findMany({ where: { deletedAt: null }, select: { id: true, nome: true } });
    const tipoMap = Object.fromEntries(tipos.map((t) => [t.id, t.nome]));
    return {
      total,
      locados,
      disponiveis: total - locados,
      porTipo: porTipo.map((p) => ({ tipo: tipoMap[p.tipoId] ?? '—', total: (p._count as any).id ?? p._count })),
    };
  }

  /** Relatório de clientes por rota. */
  async clientes(rotaId?: string) {
    const where: any = { deletedAt: null };
    if (rotaId) where.rotaId = rotaId;
    const total = await this.prisma.cliente.count({ where });
    const porRota = await this.prisma.cliente.groupBy({
      by: ['rotaId'],
      where: { deletedAt: null },
      _count: { id: true },
    });
    const rotas = await this.prisma.rota.findMany({ where: { deletedAt: null }, select: { id: true, nome: true } });
    const rotaMap = Object.fromEntries(rotas.map((r) => [r.id, r.nome]));
    return {
      total,
      porRota: porRota.map((p) => ({ rota: rotaMap[p.rotaId] ?? '—', total: (p._count as any).id ?? p._count })),
    };
  }

  /** Recebimentos por forma de pagamento no período. */
  async recebimentos(de?: Date, ate?: Date, rotaId?: string) {
    const where: any = { deletedAt: null, estornadoPorId: null };
    if (de || ate) where.dataPagamento = { ...(de && { gte: de }), ...(ate && { lte: ate }) };
    if (rotaId) where.cobranca = { locacao: { cliente: { rotaId } } };
    const porForma = await this.prisma.pagamento.groupBy({
      by: ['formaPagamento'],
      where,
      _sum: { valor: true },
      _count: { id: true },
    });
    return porForma.map((p) => ({
      forma: p.formaPagamento,
      total: Number((p._sum.valor as any)?.toFixed(2) ?? 0),
      quantidade: (p._count as any).id ?? p._count,
    }));
  }
}
