import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validarToken } from '@app/core/server';
import { PrismaService } from '../../prisma/prisma.service';
import { PUBLICO } from '../decorators/publico.decorator';

/**
 * Autenticação JWT com REVOGAÇÃO (decisão da auditoria — P0).
 * Valida a assinatura E confere a tokenVersao do token contra a versão atual
 * do usuário no banco: incrementar tokenVersao invalida todos os tokens antigos.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ehPublico = this.reflector.getAllAndOverride<boolean>(PUBLICO, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (ehPublico) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente.');
    const token = header.slice('Bearer '.length);

    // Busca a versão atual + status do usuário (fonte da revogação).
    let payloadSub: string;
    try {
      // decodifica primeiro o sub sem confiar, para buscar a versão atual
      const semVerificar = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      payloadSub = semVerificar.sub;
    } catch {
      throw new UnauthorizedException('Token malformado.');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payloadSub },
      select: { id: true, ativo: true, tokenVersao: true, deletedAt: true },
    });
    if (!usuario || !usuario.ativo || usuario.deletedAt) throw new UnauthorizedException('Usuário inválido.');

    try {
      const payload = validarToken(token, usuario.tokenVersao, 'access');
      req.usuario = { id: payload.sub, permissoes: payload.permissoes ?? [] };
      return true;
    } catch (e) {
      throw new UnauthorizedException((e as Error).message);
    }
  }
}
