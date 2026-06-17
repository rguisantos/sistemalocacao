import { Injectable } from '@nestjs/common';
import { somar } from '@app/core';
import { PrismaService } from '../prisma/prisma.service';

/** Agregações para o painel e relatórios. Somas com precisão decimal via @app/core. */
@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  private inicioDoMes(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }

  async dashboard() {
    const desde = this.inicioDoMes();
    const pagamentosMes = await this.prisma.pagamento.findMany({
      where: { deletedAt: null, estornadoPorId: null, dataPagamento: { gte: desde } },
      select: { valor: true },
    });
    const faturamentoMes = somar(...pagamentosMes.map((p) => p.valor.toString())).toFixed(2);

    const locacoesComSaldo = await this.prisma.locacao.findMany({
      where: { status: 'ATIVA', deletedAt: null }, select: { saldoDevedorAtual: true },
    });
    const saldosPendentes = await this.prisma.saldoDevedorLocacao.findMany({
      where: { status: 'PENDENTE', deletedAt: null }, select: { valorRestante: true },
    });
    const inadimplencia = somar(
      ...locacoesComSaldo.map((l) => l.saldoDevedorAtual.toString()).filter((v) => Number(v) > 0),
      ...saldosPendentes.map((s) => s.valorRestante.toString()),
    ).toFixed(2);

    const locacoesAtivas = await this.prisma.locacao.count({ where: { status: 'ATIVA', deletedAt: null } });
    const porRota = await this.faturamentoPorRota(desde, new Date());

    return {
      faturamentoMes: Number(faturamentoMes),
      inadimplencia: Number(inadimplencia),
      locacoesAtivas,
      porRota: porRota.map((r) => ({ rota: r.rota, valor: Number(r.valor) })),
    };
  }

  /** Faturamento (pagamentos) por rota no período. */
  async faturamentoPorRota(de: Date, ate: Date) {
    const pagamentos = await this.prisma.pagamento.findMany({
      where: { deletedAt: null, estornadoPorId: null, dataPagamento: { gte: de, lte: ate } },
      select: { valor: true, cobranca: { select: { locacao: { select: { cliente: { select: { rota: { select: { nome: true } } } } } } } } },
    });
    const mapa = new Map<string, string[]>();
    for (const p of pagamentos) {
      const rota = p.cobranca?.locacao?.cliente?.rota?.nome ?? 'Sem rota';
      (mapa.get(rota) ?? mapa.set(rota, []).get(rota)!).push(p.valor.toString());
    }
    return [...mapa.entries()].map(([rota, valores]) => ({ rota, valor: somar(...valores).toFixed(2) }));
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
}
