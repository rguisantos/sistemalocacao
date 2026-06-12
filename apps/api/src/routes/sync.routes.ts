import { Router } from 'express';
import { autenticar } from '../middleware/auth';
import { rateLimitSync } from '../middleware/rateLimit';
import * as syncService from '../services/sync.service';
import { z } from 'zod';

export const syncRouter = Router();
syncRouter.use(autenticar, rateLimitSync);

const pushSchema = z.object({
  deviceId: z.string().min(1),
  registros: z.array(z.object({
    id: z.string().min(1),
    entidade: z.string().min(1),
    operacao: z.enum(['create', 'update', 'delete']),
    version: z.number(),
    baseVersion: z.number().optional(),
    dados: z.record(z.unknown()),
  })).max(500, 'Máximo de 500 registros por push'),
});

syncRouter.post('/push', async (req, res, next) => {
  try {
    const { deviceId, registros } = pushSchema.parse(req.body);
    const resultados = await syncService.processarPush(req.auth!.sub, registros, deviceId);
    res.json({ resultados });
  } catch (e) { next(e); }
});

syncRouter.post('/pull', async (req, res, next) => {
  try {
    const { lastSyncTimestamp } = z.object({ lastSyncTimestamp: z.number().min(0) }).parse(req.body);
    res.json(await syncService.processarPull(req.auth!, lastSyncTimestamp));
  } catch (e) { next(e); }
});
