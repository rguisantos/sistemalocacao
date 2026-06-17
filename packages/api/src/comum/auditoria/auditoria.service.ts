import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Campos que NUNCA podem ser gravados no log de auditoria (decisão da auditoria — P2). */
const CAMPOS_SENSIVEIS = new Set(['senha', 'senhaAtual', 'novaSenha', 'token', 'accessToken', 'refreshToken', 'tokenVersao']);

export function sanitizar(dados: unknown): unknown {
  if (dados === null || dados === undefined) return dados;
  if (typeof dados !== 'object') return dados;
  if (dados instanceof Date) return dados.toISOString();
  if (Array.isArray(dados)) return dados.map(sanitizar);
  // Objetos não-simples (ex.: Prisma.Decimal/decimal.js) não são serializáveis em JSON
  // pelo Prisma (têm métodos → "[object Function]"). Converte pelo toString antes de gravar.
  const proto = Object.getPrototypeOf(dados);
  if (proto !== Object.prototype && proto !== null) {
    return typeof (dados as { toString?: () => string }).toString === 'function'
      ? String(dados) : undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dados as Record<string, unknown>)) {
    out[k] = CAMPOS_SENSIVEIS.has(k) ? '[REMOVIDO]' : sanitizar(v);
  }
  return out;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(p: {
    usuarioId?: string; acao: string; entidade: string; entidadeId?: string;
    dadosAnteriores?: unknown; dadosNovos?: unknown; ip?: string;
  }): Promise<void> {
    await this.prisma.logAuditoria.create({
      data: {
        usuarioId: p.usuarioId,
        acao: p.acao,
        entidade: p.entidade,
        entidadeId: p.entidadeId,
        dadosAnteriores: sanitizar(p.dadosAnteriores) as object | undefined,
        dadosNovos: sanitizar(p.dadosNovos) as object | undefined,
        ip: p.ip,
      },
    });
  }

  /** Consulta paginada dos logs, com filtros opcionais. */
  async listar(f: { entidade?: string; usuarioId?: string; de?: string; ate?: string; pagina?: number }) {
    const take = 50;
    const skip = ((f.pagina ?? 1) - 1) * take;
    const where: any = {};
    if (f.entidade) where.entidade = f.entidade;
    if (f.usuarioId) where.usuarioId = f.usuarioId;
    if (f.de || f.ate) where.criadoEm = { ...(f.de && { gte: new Date(f.de) }), ...(f.ate && { lte: new Date(f.ate) }) };
    const [itens, total] = await Promise.all([
      this.prisma.logAuditoria.findMany({ where, orderBy: { criadoEm: 'desc' }, skip, take }),
      this.prisma.logAuditoria.count({ where }),
    ]);
    return { itens, total, pagina: f.pagina ?? 1, porPagina: take };
  }
}
