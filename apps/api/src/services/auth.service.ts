// apps/api/src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '@locacoes/database';
import { env } from '../config/env';
import { HttpError } from '../middleware/error';
import { registrarAuditoria } from './audit.service';
import type { AuthPayload } from '../middleware/auth';
import type { AuthResponse, UsuarioDTO } from '@locacoes/shared';

function montarUsuarioDTO(usuario: {
  id: string;
  nome: string;
  cpf: string;
  ativo: boolean;
  permissoes: { permissao: { chave: string } }[];
  rotas: { rota: { id: string; nome: string } }[];
}): UsuarioDTO {
  return {
    id: usuario.id,
    nome: usuario.nome,
    cpf: usuario.cpf,
    ativo: usuario.ativo,
    permissoes: usuario.permissoes.map((p) => p.permissao.chave),
    rotas: usuario.rotas.map((r) => ({ id: r.rota.id, nome: r.rota.nome })),
  };
}

async function emitirTokens(dto: UsuarioDTO): Promise<{ accessToken: string; refreshToken: string }> {
  const payload: AuthPayload = {
    sub: dto.id,
    permissoes: dto.permissoes,
    rotaIds: dto.rotas.map((r) => r.id),
  };
  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);

  // Refresh token: opaco + persistido = REVOGÁVEL
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const dias = parseInt(env.JWT_REFRESH_EXPIRES_IN) || 7;
  await prisma.refreshToken.create({
    data: {
      token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      usuarioId: dto.id,
      expiresAt: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
    },
  });
  return { accessToken, refreshToken };
}

export async function login(cpf: string, senha: string, ip?: string): Promise<AuthResponse> {
  const usuario = await prisma.usuario.findUnique({
    where: { cpf },
    include: {
      permissoes: { include: { permissao: true } },
      rotas: { include: { rota: true } },
    },
  });

  const senhaOk = usuario ? await bcrypt.compare(senha, usuario.senhaHash) : false;

  if (!usuario || !senhaOk || !usuario.ativo || usuario.isDeleted) {
    await registrarAuditoria({
      acao: 'login_falha',
      entidade: 'Usuario',
      entidadeId: usuario?.id ?? null,
      dadosNovos: { cpf: cpf.replace(/\d(?=\d{4})/g, '*'), ip },
    });
    throw new HttpError(401, 'CPF ou senha inválidos');
  }

  const dto = montarUsuarioDTO(usuario);
  const tokens = await emitirTokens(dto);
  await registrarAuditoria({ usuarioId: usuario.id, acao: 'login', entidade: 'Usuario', entidadeId: usuario.id });
  return { ...tokens, usuario: dto };
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const stored = await prisma.refreshToken.findUnique({
    where: { token: hash },
    include: {
      usuario: {
        include: {
          permissoes: { include: { permissao: true } },
          rotas: { include: { rota: true } },
        },
      },
    },
  });

  if (!stored || stored.expiresAt < new Date()) {
    throw new HttpError(401, 'Refresh token inválido ou expirado');
  }

  // SEGURANÇA: reuso de token já rotacionado = forte indício de token
  // vazado/roubado. Revoga TODAS as sessões do usuário e audita.
  // EXCEÇÃO: janela de tolerância de 60s cobre corridas legítimas
  // (múltiplas abas do painel, retry de rede após timeout).
  const GRACE_MS = 60_000;
  if (stored.revokedAt && Date.now() - stored.revokedAt.getTime() < GRACE_MS) {
    // corrida benigna: segue o fluxo normal e emite novos tokens
  } else if (stored.revokedAt) {
    await revogarTodosTokens(stored.usuarioId);
    await registrarAuditoria({
      usuarioId: stored.usuarioId,
      acao: 'refresh_token_reuso_detectado',
      entidade: 'Usuario',
      entidadeId: stored.usuarioId,
      dadosNovos: { motivo: 'Token rotacionado foi reutilizado; todas as sessões revogadas' },
    });
    throw new HttpError(401, 'Sessão inválida. Faça login novamente.');
  }
  if (!stored.usuario.ativo || stored.usuario.isDeleted) {
    throw new HttpError(401, 'Usuário inativo');
  }

  // Rotação: revoga o token usado e emite novo
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const dto = montarUsuarioDTO(stored.usuario);
  const tokens = await emitirTokens(dto);
  return { ...tokens, usuario: dto };
}

export async function logout(refreshToken: string): Promise<void> {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await prisma.refreshToken.updateMany({
    where: { token: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoga TODOS os tokens de um usuário (ex.: troca de senha, desativação) */
export async function revogarTodosTokens(usuarioId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { usuarioId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
