import { Router } from 'express';
import { prisma } from '@locacoes/database';
import { clienteSchema, enderecoSchema, PERMISSOES } from '@locacoes/shared';
import { autenticar, exigirPermissao, verificarAcessoRota } from '../middleware/auth';
import { registrarAuditoria } from '../services/audit.service';
import { HttpError } from '../middleware/error';
import { json } from '../utils';
import { z } from 'zod';

export const clientesRouter = Router();
clientesRouter.use(autenticar);

clientesRouter.get('/', async (req, res, next) => {
  try {
    const { rotaId, busca } = req.query as { rotaId?: string; busca?: string };
    const todasRotas = req.auth!.permissoes.includes(PERMISSOES.VISUALIZAR_CLIENTES_TODAS_ROTAS);
    const filtroRota = rotaId
      ? { rotaId }
      : todasRotas
        ? {}
        : { rotaId: { in: req.auth!.rotaIds } };

    if (rotaId && !(await verificarAcessoRota(req, rotaId))) {
      throw new HttpError(403, 'Sem acesso a esta rota');
    }

    const clientes = await prisma.cliente.findMany({
      where: {
        isDeleted: false,
        ...filtroRota,
        ...(busca
          ? { OR: [{ nome: { contains: busca, mode: 'insensitive' } }, { cpfCnpj: { contains: busca } }] }
          : {}),
      },
      include: {
        enderecos: { where: { isDeleted: false } },
        rota: { select: { id: true, nome: true } },
        _count: { select: { locacoes: { where: { status: 'ATIVA', isDeleted: false } } } },
      },
      orderBy: { nome: 'asc' },
    });
    res.json(json(clientes));
  } catch (e) { next(e); }
});

clientesRouter.get('/:id', async (req, res, next) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: req.params.id },
      include: {
        enderecos: { where: { isDeleted: false } },
        rota: true,
        locacoes: {
          where: { isDeleted: false },
          include: {
            produto: { include: { tipoProduto: true } },
            endereco: true,
            cobrancas: { orderBy: { dataCobranca: 'desc' }, take: 1, where: { isDeleted: false } },
          },
          orderBy: { dataInicio: 'desc' },
        },
        saldosDevedores: {
          where: { status: 'PENDENTE', isDeleted: false },
          include: { locacao: { include: { produto: true } }, pagamentos: true },
        },
      },
    });
    if (!cliente || cliente.isDeleted) throw new HttpError(404, 'Cliente não encontrado');
    if (!(await verificarAcessoRota(req, cliente.rotaId))) throw new HttpError(403, 'Sem acesso a esta rota');
    res.json(json(cliente));
  } catch (e) { next(e); }
});

clientesRouter.post('/', exigirPermissao(PERMISSOES.GERENCIAR_CLIENTES), async (req, res, next) => {
  try {
    const input = clienteSchema.parse(req.body);
    const cliente = await prisma.cliente.create({
      data: { ...input, telefones: input.telefones as any, version: BigInt(Date.now()) },
    });
    await registrarAuditoria({ req, acao: 'criar_cliente', entidade: 'Cliente', entidadeId: cliente.id, dadosNovos: input });
    res.status(201).json(json(cliente));
  } catch (e) { next(e); }
});

clientesRouter.put('/:id', exigirPermissao(PERMISSOES.GERENCIAR_CLIENTES), async (req, res, next) => {
  try {
    const input = clienteSchema.partial().parse(req.body);
    const anterior = await prisma.cliente.findUnique({ where: { id: req.params.id } });
    if (!anterior || anterior.isDeleted) throw new HttpError(404, 'Cliente não encontrado');

    // Transferência de rota exige permissão específica
    if (input.rotaId && input.rotaId !== anterior.rotaId) {
      if (!req.auth!.permissoes.includes(PERMISSOES.TRANSFERIR_CLIENTE_ROTA)) {
        throw new HttpError(403, 'Sem permissão para transferir cliente de rota');
      }
    }
    const cliente = await prisma.cliente.update({
      where: { id: req.params.id },
      data: { ...input, telefones: input.telefones as any, version: BigInt(Date.now()) },
    });
    await registrarAuditoria({ req, acao: 'editar_cliente', entidade: 'Cliente', entidadeId: cliente.id, dadosAnteriores: json(anterior), dadosNovos: input });
    res.json(json(cliente));
  } catch (e) { next(e); }
});

clientesRouter.post('/:id/enderecos', exigirPermissao(PERMISSOES.GERENCIAR_CLIENTES), async (req, res, next) => {
  try {
    const input = enderecoSchema.parse(req.body);
    const endereco = await prisma.endereco.create({
      data: { ...input, clienteId: req.params.id, version: BigInt(Date.now()) },
    });
    res.status(201).json(json(endereco));
  } catch (e) { next(e); }
});

clientesRouter.delete('/:id', exigirPermissao(PERMISSOES.GERENCIAR_CLIENTES), async (req, res, next) => {
  try {
    const ativas = await prisma.locacao.count({ where: { clienteId: req.params.id, status: 'ATIVA', isDeleted: false } });
    if (ativas > 0) throw new HttpError(409, 'Cliente possui locações ativas');
    await prisma.cliente.update({ where: { id: req.params.id }, data: { isDeleted: true, version: BigInt(Date.now()) } });
    await registrarAuditoria({ req, acao: 'excluir_cliente', entidade: 'Cliente', entidadeId: req.params.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
