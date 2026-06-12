import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '@locacoes/database';
import { usuarioCreateSchema, usuarioUpdateSchema, PERMISSOES } from '@locacoes/shared';
import { autenticar, exigirPermissao } from '../middleware/auth';
import { registrarAuditoria } from '../services/audit.service';
import { revogarTodosTokens } from '../services/auth.service';
import { HttpError } from '../middleware/error';
import { param } from '../utils';

export const usuariosRouter = Router();
usuariosRouter.use(autenticar, exigirPermissao(PERMISSOES.GERENCIAR_USUARIOS));

const includeUsuario = {
  permissoes: { include: { permissao: true } },
  rotas: { include: { rota: true } },
} as const;

function sanitizar(u: any) {
  const { senhaHash, ...resto } = u;
  return {
    ...resto,
    version: u.version?.toString(),
    permissoes: u.permissoes?.map((p: any) => p.permissao.chave) ?? [],
    rotas: u.rotas?.map((r: any) => ({ id: r.rota.id, nome: r.rota.nome })) ?? [],
  };
}

usuariosRouter.get('/', async (_req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { isDeleted: false },
      include: includeUsuario,
      orderBy: { nome: 'asc' },
    });
    res.json(usuarios.map(sanitizar));
  } catch (e) { next(e); }
});

usuariosRouter.post('/', async (req, res, next) => {
  try {
    const input = usuarioCreateSchema.parse(req.body);
    const senhaHash = await bcrypt.hash(input.senha, 12);
    const permissoes = await prisma.permissao.findMany({ where: { chave: { in: input.permissoes } } });

    const usuario = await prisma.usuario.create({
      data: {
        nome: input.nome,
        cpf: input.cpf,
        senhaHash,
        ativo: input.ativo,
        version: BigInt(Date.now()),
        permissoes: { create: permissoes.map((p) => ({ permissaoId: p.id })) },
        rotas: { create: input.rotaIds.map((rotaId) => ({ rotaId })) },
      },
      include: includeUsuario,
    });
    await registrarAuditoria({ req, acao: 'criar_usuario', entidade: 'Usuario', entidadeId: usuario.id, dadosNovos: { nome: input.nome, cpf: input.cpf, permissoes: input.permissoes } });
    res.status(201).json(sanitizar(usuario));
  } catch (e) { next(e); }
});

usuariosRouter.put('/:id', async (req, res, next) => {
  try {
    const input = usuarioUpdateSchema.parse(req.body);
    const anterior = await prisma.usuario.findUnique({ where: { id: param(req.params.id) }, include: includeUsuario });
    if (!anterior || anterior.isDeleted) throw new HttpError(404, 'Usuário não encontrado');

    const data: any = { version: BigInt(Date.now()) };
    if (input.nome) data.nome = input.nome;
    if (input.ativo !== undefined) data.ativo = input.ativo;
    if (input.senha) data.senhaHash = await bcrypt.hash(input.senha, 12);

    const usuario = await prisma.$transaction(async (tx: any) => {
      if (input.permissoes) {
        await tx.usuarioPermissao.deleteMany({ where: { usuarioId: param(req.params.id) } });
        const perms = await tx.permissao.findMany({ where: { chave: { in: input.permissoes } } });
        await tx.usuarioPermissao.createMany({ data: perms.map((p: any) => ({ usuarioId: param(req.params.id), permissaoId: p.id })) });
      }
      if (input.rotaIds) {
        await tx.usuarioRota.deleteMany({ where: { usuarioId: param(req.params.id) } });
        await tx.usuarioRota.createMany({ data: input.rotaIds.map((rotaId: string) => ({ usuarioId: param(req.params.id), rotaId })) });
      }
      return tx.usuario.update({ where: { id: param(req.params.id) }, data, include: includeUsuario });
    });

    // Segurança: troca de senha ou desativação revoga todas as sessões
    if (input.senha || input.ativo === false || input.permissoes) {
      await revogarTodosTokens(param(req.params.id));
    }
    await registrarAuditoria({ req, acao: 'editar_usuario', entidade: 'Usuario', entidadeId: usuario.id, dadosAnteriores: sanitizar(anterior), dadosNovos: sanitizar(usuario) });
    res.json(sanitizar(usuario));
  } catch (e) { next(e); }
});

usuariosRouter.delete('/:id', async (req, res, next) => {
  try {
    if (param(req.params.id) === req.auth!.sub) throw new HttpError(400, 'Não é possível excluir o próprio usuário');
    await prisma.usuario.update({ where: { id: param(req.params.id) }, data: { isDeleted: true, ativo: false, version: BigInt(Date.now()) } });
    await revogarTodosTokens(param(req.params.id));
    await registrarAuditoria({ req, acao: 'excluir_usuario', entidade: 'Usuario', entidadeId: param(req.params.id) });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

usuariosRouter.get('/permissoes', async (_req, res, next) => {
  try {
    res.json(await prisma.permissao.findMany({ orderBy: [{ grupo: 'asc' }, { chave: 'asc' }] }));
  } catch (e) { next(e); }
});
