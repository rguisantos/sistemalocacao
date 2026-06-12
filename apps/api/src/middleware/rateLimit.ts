import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { env } from '../config/env';

function criarLimiter(pontos: number, duracaoSeg: number, prefixo: string): RateLimiterAbstract {
  if (env.REDIS_URL) {
    const client = new Redis(env.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
    client.on('error', (e) => console.error('[redis]', e.message));
    return new RateLimiterRedis({
      storeClient: client,
      points: pontos,
      duration: duracaoSeg,
      keyPrefix: prefixo,
      insuranceLimiter: new RateLimiterMemory({ points: pontos, duration: duracaoSeg }),
    });
  }
  console.warn(`[rate-limit] REDIS_URL ausente — usando memória (NÃO use em produção serverless)`);
  return new RateLimiterMemory({ points: pontos, duration: duracaoSeg, keyPrefix: prefixo });
}

// Login: 5 tentativas por 15min por IP+CPF
const loginLimiter = criarLimiter(5, 15 * 60, 'rl:login');
// Sync: 30 por minuto por usuário
const syncLimiter = criarLimiter(30, 60, 'rl:sync');
// API geral: 300 por minuto por usuário/IP
const apiLimiter = criarLimiter(300, 60, 'rl:api');

function aplicar(limiter: RateLimiterAbstract, chave: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await limiter.consume(chave(req));
      next();
    } catch (rej: any) {
      const retrySec = Math.ceil((rej?.msBeforeNext ?? 60000) / 1000);
      res.set('Retry-After', String(retrySec));
      res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
    }
  };
}

export const rateLimitLogin = aplicar(
  loginLimiter,
  (req) => `${req.ip}:${(req.body?.cpf ?? '').slice(0, 11)}`
);
export const rateLimitSync = aplicar(syncLimiter, (req) => req.auth?.sub ?? req.ip ?? 'anon');
export const rateLimitApi = aplicar(apiLimiter, (req) => req.auth?.sub ?? req.ip ?? 'anon');
