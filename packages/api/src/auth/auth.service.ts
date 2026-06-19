import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { emitirTokens, validarToken } from '@app/core/server';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Autenticação (decisões da auditoria — P0/P1):
 *  - Senha com argon2id.
 *  - Tokens via @app/core (secret por env, revogação por tokenVersao).
 *  - Logout global = incrementar tokenVersao (invalida todos os tokens).
 */
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private cfg() {
    return { accessTtl: process.env.JWT_ACCESS_TTL, refreshTtl: process.env.JWT_REFRESH_TTL };
  }

  async login(cpf: string, senha: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { cpf },
      include: { permissoes: { include: { permissao: true } } },
    });
    // Mensagem genérica para não revelar se o CPF existe.
    const invalido = () => new UnauthorizedException('CPF ou senha inválidos.');
    if (!usuario || !usuario.ativo || usuario.deletedAt) throw invalido();

    const ok = await argon2.verify(usuario.senha, senha).catch(() => false);
    if (!ok) throw invalido();

    const permissoes = usuario.permissoes.map((p) => p.permissao.chave);
    const tokens = emitirTokens(usuario.id, usuario.tokenVersao, permissoes, this.cfg());
    return { ...tokens, usuario: { id: usuario.id, nome: usuario.nome, permissoes } };
  }

  async refresh(refreshToken: string) {
    const sub = this.subDoToken(refreshToken);
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: sub },
      include: { permissoes: { include: { permissao: true } } },
    });
    if (!usuario || !usuario.ativo || usuario.deletedAt) throw new UnauthorizedException('Sessão inválida.');

    // Confere versão (revogação) antes de reemitir.
    validarToken(refreshToken, usuario.tokenVersao, 'refresh');
    const permissoes = usuario.permissoes.map((p) => p.permissao.chave);
    return emitirTokens(usuario.id, usuario.tokenVersao, permissoes, this.cfg());
  }

  /** Logout global: invalida instantaneamente todos os tokens já emitidos. */
  async logoutGlobal(usuarioId: string) {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { tokenVersao: { increment: 1 } },
    });
  }

  private subDoToken(token: string): string {
    try {
      return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub;
    } catch {
      throw new UnauthorizedException('Token malformado.');
    }
  }
}
