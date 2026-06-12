import { Router } from 'express';
import { prisma } from '@locacoes/database';
import { Prisma } from '@prisma/client';
import { PERMISSOES } from '@locacoes/shared';
import { autenticar, exigirPermissao } from '../middleware/auth';
import { json, param } from '../utils';
import { HttpError } from '../middleware/error';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { listarVencidas, contarVencidas } from '../services/vencidas.service';

export const relatoriosRouter = Router();
relatoriosRouter.use(autenticar);

const periodoSchema = z.object({
  inicio: z.coerce.date(),
  fim: z.coerce.date(),
  rotaId: z.string().optional(),
});

// Dashboard: agregações em UMA query SQL (evita N+1)
relatoriosRouter.get('/dashboard', exigirPermissao(PERMISSOES.VISUALIZAR_RELATORIOS), async (_req, res, next) => {
  try {
    const inicioMes = new Date();
    inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);

    const [faturamento, inadimplencia, locacoesAtivas, topCobradores, porRota] = await Promise.all([
      prisma.cobranca.aggregate({
        _sum: { valorRecebidoPago: true },
        where: { dataCobranca: { gte: inicioMes }, isDeleted: false },
      }),
      prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(
          (SELECT SUM(valor_restante) FROM saldos_devedores_locacao WHERE status = 'PENDENTE' AND is_deleted = false), 0
        ) + COALESCE(
          (SELECT SUM(saldo_atual) FROM locacoes WHERE status = 'ATIVA' AND saldo_atual > 0 AND is_deleted = false), 0
        ) AS total`,
      prisma.locacao.count({ where: { status: 'ATIVA', isDeleted: false } }),
      prisma.$queryRaw`
        SELECT u.nome, COUNT(c.id)::int AS cobrancas, COALESCE(SUM(c.valor_recebido_pago), 0)::text AS total
        FROM cobrancas c JOIN usuarios u ON u.id = c.usuario_id
        WHERE c.data_cobranca >= ${inicioMes} AND c.is_deleted = false
        GROUP BY u.id, u.nome ORDER BY SUM(c.valor_recebido_pago) DESC LIMIT 5`,
      prisma.$queryRaw`
        SELECT r.nome, COALESCE(SUM(c.valor_recebido_pago), 0)::text AS total
        FROM cobrancas c
        JOIN locacoes l ON l.id = c.locacao_id
        JOIN clientes cl ON cl.id = l.cliente_id
        JOIN rotas r ON r.id = cl.rota_id
        WHERE c.data_cobranca >= ${inicioMes} AND c.is_deleted = false
        GROUP BY r.id, r.nome ORDER BY r.nome`,
    ]);

    res.json(json({
      faturamentoMes: faturamento._sum.valorRecebidoPago?.toFixed(2) ?? '0.00',
      inadimplencia: inadimplencia[0]?.total ?? '0',
      locacoesAtivas,
      topCobradores,
      faturamentoPorRota: porRota,
    }));
  } catch (e) { next(e); }
});

// Cobranças vencidas (valor fixo com período estourado / percentual sem leitura)
relatoriosRouter.get('/vencidas', async (req, res, next) => {
  try {
    const { diasPercentual } = req.query as Record<string, string>;
    const todasRotas = req.auth!.permissoes.includes(PERMISSOES.VISUALIZAR_CLIENTES_TODAS_ROTAS);
    res.json(json(await listarVencidas({
      todasRotas,
      rotaIds: req.auth!.rotaIds,
      diasPercentual: diasPercentual ? parseInt(diasPercentual, 10) : undefined,
    })));
  } catch (e) { next(e); }
});

relatoriosRouter.get('/vencidas/resumo', async (req, res, next) => {
  try {
    const todasRotas = req.auth!.permissoes.includes(PERMISSOES.VISUALIZAR_CLIENTES_TODAS_ROTAS);
    res.json(json(await contarVencidas({ todasRotas, rotaIds: req.auth!.rotaIds })));
  } catch (e) { next(e); }
});

// Faturamento por período/rota
relatoriosRouter.get('/faturamento', exigirPermissao(PERMISSOES.VISUALIZAR_RELATORIOS), async (req, res, next) => {
  try {
    const { inicio, fim, rotaId } = periodoSchema.parse(req.query);
    const dados = await prisma.$queryRaw`
      SELECT r.nome AS rota,
             COUNT(c.id)::int AS qtd_cobrancas,
             COALESCE(SUM(c.valor_liquido_final), 0)::text AS valor_devido,
             COALESCE(SUM(c.valor_recebido_pago), 0)::text AS valor_recebido
      FROM cobrancas c
      JOIN locacoes l ON l.id = c.locacao_id
      JOIN clientes cl ON cl.id = l.cliente_id
      JOIN rotas r ON r.id = cl.rota_id
      WHERE c.data_cobranca BETWEEN ${inicio} AND ${fim}
        AND c.is_deleted = false
        ${rotaId ? Prisma.sql`AND r.id = ${rotaId}` : Prisma.empty}
      GROUP BY r.id, r.nome ORDER BY r.nome`;
    res.json(json(dados));
  } catch (e) { next(e); }
});

// ============================================================
// RELATÓRIO FLEXÍVEL: uma dimensão × métricas fixas
// Cobre os pré-definidos: faturamento por rota/cobrador/cliente/
// produto/forma de pagamento, comparativo de rotas, evolução mensal,
// e "produtos mais lucrativos" (dimensão produto, já ordenado por recebido).
// ============================================================
const DIMENSOES: Record<string, { expr: string; rotulo: string }> = {
  rota: { expr: 'r.nome', rotulo: 'Rota' },
  cobrador: { expr: 'u.nome', rotulo: 'Cobrador' },
  cliente: { expr: 'cl.nome', rotulo: 'Cliente' },
  produto: { expr: "(p.plaqueta || ' — ' || tp.nome)", rotulo: 'Produto' },
  forma_pagamento: { expr: 'c.forma_pagamento::text', rotulo: 'Forma de pagamento' },
  mes: { expr: "to_char(c.data_cobranca, 'YYYY-MM')", rotulo: 'Mês' },
  dia: { expr: "to_char(c.data_cobranca, 'YYYY-MM-DD')", rotulo: 'Dia' },
};

interface LinhaFlexivel { chave: string; qtd: number; valor_devido: string; valor_recebido: string }

async function consultarFlexivel(query: Record<string, unknown>) {
  const { inicio, fim, rotaId } = periodoSchema.parse(query);
  const dimensao = String(query.dimensao ?? 'rota');
  const dim = DIMENSOES[dimensao];
  if (!dim) throw new HttpError(400, `Dimensão inválida. Use: ${Object.keys(DIMENSOES).join(', ')}`);

  // dim.expr vem de whitelist — seguro interpolar com Prisma.raw
  const linhas = await prisma.$queryRaw<LinhaFlexivel[]>`
      SELECT ${Prisma.raw(dim.expr)} AS chave,
             COUNT(c.id)::int AS qtd,
             COALESCE(SUM(c.valor_liquido_final), 0)::text AS valor_devido,
             COALESCE(SUM(c.valor_recebido_pago), 0)::text AS valor_recebido
      FROM cobrancas c
      JOIN locacoes l ON l.id = c.locacao_id
      JOIN clientes cl ON cl.id = l.cliente_id
      JOIN rotas r ON r.id = cl.rota_id
      JOIN usuarios u ON u.id = c.usuario_id
      JOIN produtos p ON p.id = l.produto_id
      JOIN tipos_produto tp ON tp.id = p.tipo_produto_id
      WHERE c.data_cobranca BETWEEN ${inicio} AND ${fim}
        AND c.is_deleted = false
        ${rotaId ? Prisma.sql`AND r.id = ${rotaId}` : Prisma.empty}
      GROUP BY ${Prisma.raw(dim.expr)}
      ORDER BY SUM(c.valor_recebido_pago) DESC
      LIMIT 500`;
  return { dimensao, rotulo: dim.rotulo, inicio, fim, linhas };
}

relatoriosRouter.get('/flexivel', exigirPermissao(PERMISSOES.VISUALIZAR_RELATORIOS), async (req, res, next) => {
  try {
    res.json(json(await consultarFlexivel(req.query)));
  } catch (e) { next(e); }
});

// PDF gerado no SERVIDOR (spec §8) — stream direto, sem arquivo temporário
relatoriosRouter.get('/flexivel.pdf', exigirPermissao(PERMISSOES.EXPORTAR_RELATORIOS_PDF), async (req, res, next) => {
  try {
    const { rotulo, dimensao, inicio, fim, linhas } = await consultarFlexivel(req.query);
    const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const data = (d: Date) => d.toLocaleDateString('pt-BR');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio_${dimensao}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    doc.pipe(res);

    // Cabeçalho
    doc.fontSize(16).fillColor('#1b5e3f').text('Sistema de Locações — Relatório', { align: 'center' });
    doc.fontSize(11).fillColor('#444')
      .text(`Faturamento por ${rotulo.toLowerCase()} · ${data(inicio)} a ${data(fim)}`, { align: 'center' })
      .moveDown(1);

    // Tabela (posições fixas, quebra de página manual)
    const X = { chave: 40, qtd: 280, devido: 340, recebido: 425, ef: 515 } as const;
    const cabecalho = (y: number) => {
      doc.fontSize(9).fillColor('#888');
      doc.text(rotulo, X.chave, y, { width: 230 });
      doc.text('Cobr.', X.qtd, y, { width: 50, align: 'right' });
      doc.text('Devido', X.devido, y, { width: 75, align: 'right' });
      doc.text('Recebido', X.recebido, y, { width: 80, align: 'right' });
      doc.text('Efic.', X.ef, y, { width: 40, align: 'right' });
      doc.moveTo(40, y + 13).lineTo(555, y + 13).strokeColor('#cccccc').stroke();
    };

    let y = doc.y;
    cabecalho(y);
    y += 20;

    let totQtd = 0, totDev = 0, totRec = 0;
    doc.fontSize(9).fillColor('#222');
    for (const l of linhas) {
      if (y > 770) { doc.addPage(); y = 40; cabecalho(y); y += 20; doc.fontSize(9).fillColor('#222'); }
      const dev = Number(l.valor_devido), rec = Number(l.valor_recebido);
      totQtd += Number(l.qtd); totDev += dev; totRec += rec;
      doc.text(String(l.chave).slice(0, 60), X.chave, y, { width: 230, lineBreak: false });
      doc.text(String(l.qtd), X.qtd, y, { width: 50, align: 'right' });
      doc.text(brl.format(dev), X.devido, y, { width: 75, align: 'right' });
      doc.text(brl.format(rec), X.recebido, y, { width: 80, align: 'right' });
      doc.text(`${dev > 0 ? Math.round((rec / dev) * 100) : 100}%`, X.ef, y, { width: 40, align: 'right' });
      y += 16;
    }

    // Totais
    if (y > 760) { doc.addPage(); y = 40; }
    doc.moveTo(40, y).lineTo(555, y).strokeColor('#1b5e3f').stroke();
    y += 6;
    doc.fontSize(10).fillColor('#1b5e3f');
    doc.text('Total', X.chave, y, { width: 230 });
    doc.text(String(totQtd), X.qtd, y, { width: 50, align: 'right' });
    doc.text(brl.format(totDev), X.devido, y, { width: 75, align: 'right' });
    doc.text(brl.format(totRec), X.recebido, y, { width: 80, align: 'right' });
    doc.text(`${totDev > 0 ? Math.round((totRec / totDev) * 100) : 100}%`, X.ef, y, { width: 40, align: 'right' });

    doc.fontSize(8).fillColor('#999')
      .text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 40, 800, { align: 'center', width: 515 });
    doc.end();
  } catch (e) { next(e); }
});

// Histórico de locações de um produto (spec: relatórios pré-definidos)
relatoriosRouter.get('/historico-produto/:produtoId', exigirPermissao(PERMISSOES.VISUALIZAR_RELATORIOS), async (req, res, next) => {
  try {
    const locacoes = await prisma.locacao.findMany({
      where: { produtoId: param(req.params.produtoId), isDeleted: false },
      include: {
        cliente: { select: { nome: true } },
        endereco: { select: { logradouro: true, numero: true, bairro: true } },
        deposito: { select: { nome: true } },
        _count: { select: { cobrancas: { where: { isDeleted: false } } } },
      },
      orderBy: { dataInicio: 'desc' },
    });
    const totais = await prisma.cobranca.groupBy({
      by: ['locacaoId'],
      where: { locacao: { produtoId: param(req.params.produtoId) }, isDeleted: false },
      _sum: { valorRecebidoPago: true },
    });
    const mapaTotais = Object.fromEntries(
      totais.map((t: any) => [t.locacaoId, t._sum?.valorRecebidoPago?.toFixed(2) ?? '0.00'])
    );
    res.json(json(locacoes.map((l: any) => ({ ...l, totalRecebido: mapaTotais[l.id] ?? '0.00' }))));
  } catch (e) { next(e); }
});

// Extrato por cliente
relatoriosRouter.get('/extrato-cliente/:clienteId', exigirPermissao(PERMISSOES.VISUALIZAR_RELATORIOS), async (req, res, next) => {
  try {
    const cobrancas = await prisma.cobranca.findMany({
      where: { locacao: { clienteId: param(req.params.clienteId) }, isDeleted: false },
      include: {
        locacao: { include: { produto: { select: { plaqueta: true } } } },
        usuario: { select: { nome: true } },
      },
      orderBy: { dataCobranca: 'desc' },
    });
    res.json(json(cobrancas));
  } catch (e) { next(e); }
});

// Logs de auditoria
relatoriosRouter.get('/auditoria', exigirPermissao(PERMISSOES.VISUALIZAR_LOGS_AUDITORIA), async (req, res, next) => {
  try {
    const { usuarioId, acao, pagina = '1' } = req.query as Record<string, string>;
    const take = 50;
    const logs = await prisma.logAuditoria.findMany({
      where: {
        ...(usuarioId ? { usuarioId } : {}),
        ...(acao ? { acao: { contains: acao } } : {}),
      },
      include: { usuario: { select: { nome: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip: (parseInt(pagina) - 1) * take,
    });
    res.json(json(logs));
  } catch (e) { next(e); }
});
