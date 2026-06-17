import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSOES } from '../decorators/permissoes.decorator';

/**
 * Autorização por permissão, validada NO SERVIDOR (decisão da auditoria — P1).
 * A UI pode esconder botões, mas a decisão real acontece aqui.
 */
@Injectable()
export class PermissoesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const exigidas = this.reflector.getAllAndOverride<string[]>(PERMISSOES, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!exigidas || exigidas.length === 0) return true;

    const usuario = ctx.switchToHttp().getRequest().usuario;
    const possui = new Set<string>(usuario?.permissoes ?? []);
    const faltando = exigidas.filter((p) => !possui.has(p));
    if (faltando.length) {
      throw new ForbiddenException(`Permissão necessária: ${faltando.join(', ')}`);
    }
    return true;
  }
}
