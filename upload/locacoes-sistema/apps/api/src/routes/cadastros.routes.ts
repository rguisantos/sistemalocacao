import { Router } from 'express';
import { prisma } from '@locacoes/database';
import { produtoSchema, PERMISSOES } from '@locacoes/shared';
import { autenticar, exigirPermissao } from '../middleware/auth';
import { registrarAuditoria } from '../services/audit.service';
import { HttpError } from '../middleware/error';
import { json } from '../utils';
import { z } from 'zod';

export const cadastrosRouter = Router();
cadastrosRouter.use(autenticar);

// ===== PRODUTOS =====
cadastrosRouter.get('/produtos', async (req, res, next) => {
  try {
    const { busca, tipoId, disponiveis } = req.query as Record<string, string>;
    const produtos = await prisma.produto.findMany({
      where: {
        isDeleted: false,
        ...(busca ? { plaqueta: { contains: busca, mode: 'insensitive' } } : {}),
        ...(tipoId ? { tipoProdutoId: tipoId } : {}),
        ...(disponiveis === 'true'
          ? { locacoes: { none: { status: 'ATIVA', isDeleted: false } } }
          : {}),
      },
      include: {
        tipoProduto: true, tamanho: true, condicao: true,
        locacoes: { where: { status: 'ATIVA', isDeleted: false }, include: { cliente: { select: { nome: true } } } },
      },
      orderBy: { plaqueta: 'asc' },
    });
    res.json(json(produtos));
  } catch (e) { next(e); }
});

// Produtos em depósito: última locação finalizada para DEPOSITO e sem locação ativa
cadastrosRouter.get('/produtos/em-deposito', exigirPermissao(PERMISSOES.VISUALIZAR_PRODUTOS_DEPOSITO), async (_req, res, next) => {
  try {
    const produtos = await prisma.produto.findMany({
      where: {
        isDeleted: false,
        locacoes: { none: { status: 'ATIVA', isDeleted: false } },
        AND: { locacoes: { some: { finalizacaoTipo: 'DEPOSITO', isDeleted: false } } },
      },
      include: {
        tipoProduto: true, condicao: true,
        locacoes: {
          where: { finalizacaoTipo: 'DEPOSITO', isDeleted: false },
          orderBy: { dataFim: 'desc' }, take: 1,
          include: { deposito: true, cliente: { select: { nome: true } } },
        },
      },
    });
    res.json(json(produtos));
  } catch (e) { next(e); }
});

cadastrosRouter.post('/produtos', exigirPermissao(PERMISSOES.GERENCIAR_PRODUTOS), async (req, res, next) => {
  try {
    const input = produtoSchema.parse(req.body);
    const produto = await prisma.produto.create({ data: { ...input, version: BigInt(Date.now()) } });
    await registrarAuditoria({ req, acao: 'criar_produto', entidade: 'Produto', entidadeId: produto.id, dadosNovos: input });
    res.status(201).json(json(produto));
  } catch (e) { next(e); }
});

cadastrosRouter.put('/produtos/:id', exigirPermissao(PERMISSOES.GERENCIAR_PRODUTOS), async (req, res, next) => {
  try {
    const input = produtoSchema.partial().parse(req.body);
    const anterior = await prisma.produto.findUnique({ where: { id: req.params.id } });
    if (!anterior || anterior.isDeleted) throw new HttpError(404, 'Produto não encontrado');
    const produto = await prisma.produto.update({ where: { id: req.params.id }, data: { ...input, version: BigInt(Date.now()) } });
    await registrarAuditoria({ req, acao: 'editar_produto', entidade: 'Produto', entidadeId: produto.id, dadosAnteriores: json(anterior), dadosNovos: input });
    res.json(json(produto));
  } catch (e) { next(e); }
});

// ===== CADASTROS AUXILIARES (genérico) =====
const auxConfig = {
  'tipos-produto': { model: 'tipoProduto', campo: 'nome', perm: PERMISSOES.GERENCIAR_TIPOS_PRODUTO },
  'tamanhos': { model: 'tamanho', campo: 'descricao', perm: PERMISSOES.GERENCIAR_TAMANHOS },
  'condicoes': { model: 'condicao', campo: 'descricao', perm: PERMISSOES.GERENCIAR_CONDICOES },
} as const;

for (const [path, cfg] of Object.entries(auxConfig)) {
  const model = () => (prisma as any)[cfg.model];
  cadastrosRouter.get(`/${path}`, async (_req, res, next) => {
    try { res.json(await model().findMany({ where: { ativo: true }, orderBy: { [cfg.campo]: 'asc' } })); }
    catch (e) { next(e); }
  });
  cadastrosRouter.post(`/${path}`, exigirPermissao(cfg.perm), async (req, res, next) => {
    try {
      const valor = z.object({ [cfg.campo]: z.string().min(1) }).parse(req.body);
      res.status(201).json(await model().create({ data: valor }));
    } catch (e) { next(e); }
  });
  cadastrosRouter.delete(`/${path}/:id`, exigirPermissao(cfg.perm), async (req, res, next) => {
    try {
      await model().update({ where: { id: req.params.id }, data: { ativo: false } });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
}

// ===== ROTAS =====
cadastrosRouter.get('/rotas', async (req, res, next) => {
  try {
    const todasRotas = req.auth!.permissoes.includes(PERMISSOES.VISUALIZAR_CLIENTES_TODAS_ROTAS);
    const rotas = await prisma.rota.findMany({
      where: { isDeleted: false, ...(todasRotas ? {} : { id: { in: req.auth!.rotaIds } }) },
      include: { _count: { select: { clientes: { where: { isDeleted: false } } } } },
      orderBy: { nome: 'asc' },
    });
    res.json(json(rotas));
  } catch (e) { next(e); }
});

cadastrosRouter.post('/rotas', exigirPermissao(PERMISSOES.GERENCIAR_ROTAS), async (req, res, next) => {
  try {
    const { nome } = z.object({ nome: z.string().min(1) }).parse(req.body);
    const rota = await prisma.rota.create({ data: { nome, version: BigInt(Date.now()) } });
    await registrarAuditoria({ req, acao: 'criar_rota', entidade: 'Rota', entidadeId: rota.id, dadosNovos: { nome } });
    res.status(201).json(json(rota));
  } catch (e) { next(e); }
});

// ===== DEPÓSITOS =====
cadastrosRouter.get('/depositos', async (_req, res, next) => {
  try {
    res.json(json(await prisma.deposito.findMany({ where: { isDeleted: false }, orderBy: { nome: 'asc' } })));
  } catch (e) { next(e); }
});

cadastrosRouter.post('/depositos', exigirPermissao(PERMISSOES.GERENCIAR_DEPOSITOS), async (req, res, next) => {
  try {
    const input = z.object({
      nome: z.string().min(1),
      logradouro: z.string().optional(), numero: z.string().optional(),
      bairro: z.string().optional(), cidade: z.string().optional(),
      estado: z.string().optional(), cep: z.string().optional(),
    }).parse(req.body);
    const deposito = await prisma.deposito.create({ data: { ...input, version: BigInt(Date.now()) } });
    await registrarAuditoria({ req, acao: 'criar_deposito', entidade: 'Deposito', entidadeId: deposito.id, dadosNovos: input });
    res.status(201).json(json(deposito));
  } catch (e) { next(e); }
});
