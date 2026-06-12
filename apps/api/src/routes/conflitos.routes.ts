import { Router } from 'express';
import { prisma } from '@locacoes/database';
import { PERMISSOES } from '@locacoes/shared';
import { autenticar, exigirPermissao } from '../middleware/auth';
import * as conflitoService from '../services/conflito.service';
import { json, param } from '../utils';
import { z } from 'zod';

export const conflitosRouter = Router();

// Conflitos do PRÓPRIO usuário (visível ao cobrador no app) — só autenticação.
// Read-only: a resolução continua restrita ao painel (permissão abaixo).
conflitosRouter.get('/meus', autenticar, async (req, res, next) => {
  try {
    const conflitos = await prisma.conflitSync.findMany({
      where: { usuarioOrigemId: req.auth!.sub, resolvido: false },
      select: {
        id: true, entidade: true, entidadeId: true,
        camposConflitantes: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(json(conflitos));
  } catch (e) { next(e); }
});

conflitosRouter.use(autenticar, exigirPermissao(PERMISSOES.VISUALIZAR_LOGS_AUDITORIA));

conflitosRouter.get('/', async (req, res, next) => {
  try {
    const { resolvido, entidade } = req.query as Record<string, string>;
    const conflitos = await conflitoService.listarConflitos({
      resolvido: resolvido === undefined ? false : resolvido === 'true',
      entidade,
    });
    res.json(json(conflitos));
  } catch (e) { next(e); }
});

conflitosRouter.get('/estatisticas', async (_req, res, next) => {
  try {
    res.json(json(await conflitoService.estatisticasConflitos()));
  } catch (e) { next(e); }
});

conflitosRouter.post('/:id/resolver', async (req, res, next) => {
  try {
    const { resolucao, camposMesclados } = z.object({
      resolucao: z.enum(['manter_servidor', 'aplicar_mobile', 'mesclar']),
      camposMesclados: z.record(z.unknown()).optional(),
    }).parse(req.body);

    const resultado = await conflitoService.resolverConflito(
      param(req.params.id), resolucao, req.auth!.sub, camposMesclados
    );
    res.json(json(resultado));
  } catch (e) { next(e); }
});
