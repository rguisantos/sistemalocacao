import { prisma, Prisma } from '@locacoes/database';
import { Request } from 'express';

export async function registrarAuditoria(opts: {
  req?: Request;
  usuarioId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
}) {
  try {
    await prisma.logAuditoria.create({
      data: {
        usuarioId: opts.usuarioId ?? opts.req?.auth?.sub ?? null,
        acao: opts.acao,
        entidade: opts.entidade,
        entidadeId: opts.entidadeId ?? null,
        dadosAnteriores: (opts.dadosAnteriores as Prisma.InputJsonValue) ?? undefined,
        dadosNovos: (opts.dadosNovos as Prisma.InputJsonValue) ?? undefined,
        ip: opts.req?.ip ?? null,
        userAgent: opts.req?.headers['user-agent'] ?? null,
      },
    });
  } catch (e) {
    // auditoria nunca deve derrubar a operação principal
    console.error('[auditoria] falha ao registrar:', e);
  }
}
