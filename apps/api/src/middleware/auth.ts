import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '@locacoes/database';

export interface AuthPayload {
  sub: string;          // usuario id
  permissoes: string[];
  rotaIds: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function autenticar(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/** Exige UMA das permissões listadas */
export function exigirPermissao(...chaves: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: 'Não autenticado' });
    const tem = chaves.some((c) => req.auth!.permissoes.includes(c));
    if (!tem) {
      return res.status(403).json({ error: 'Permissão insuficiente', requerida: chaves });
    }
    next();
  };
}

/** Verifica acesso à rota (cobradores só veem suas rotas) */
export async function verificarAcessoRota(req: Request, rotaId: string): Promise<boolean> {
  if (!req.auth) return false;
  if (req.auth.permissoes.includes('visualizar_clientes_todas_rotas')) return true;
  return req.auth.rotaIds.includes(rotaId);
}
