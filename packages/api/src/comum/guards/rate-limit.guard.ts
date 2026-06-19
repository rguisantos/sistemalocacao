import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verificarLimite, PoliticaLimite } from '@app/core/server';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT } from '../decorators/rate-limit.decorator';

/**
 * Rate limiting persistente por rota (decisão da auditoria — P0).
 * Só atua onde a rota declara @RateLimit(...). Chave por IP (e a rota inclui
 * o path para isolar /auth de /sync).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly redis: RedisService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const politica = this.reflector.getAllAndOverride<PoliticaLimite>(RATE_LIMIT, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!politica) return true;

    const req = ctx.switchToHttp().getRequest();
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] ?? req.ip ?? 'desconhecido').trim();
    const prefixo = req.route?.path ?? req.url;

    const r = await verificarLimite(this.redis, prefixo, ip, politica);
    if (!r.permitido) {
      throw new HttpException(
        { mensagem: 'Muitas requisições. Tente novamente em instantes.', resetEmSegundos: r.resetEmSegundos },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
