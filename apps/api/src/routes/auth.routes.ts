import { Router } from 'express';
import { loginSchema } from '@locacoes/shared';
import * as authService from '../services/auth.service';
import { rateLimitLogin } from '../middleware/rateLimit';
import { z } from 'zod';

export const authRouter = Router();

authRouter.post('/login', rateLimitLogin, async (req, res, next) => {
  try {
    const { cpf, senha } = loginSchema.parse(req.body);
    const resultado = await authService.login(cpf, senha, req.ip);
    res.json(resultado);
  } catch (e) {
    next(e);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    res.json(await authService.refresh(refreshToken));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    await authService.logout(refreshToken);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
