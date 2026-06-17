import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UsuarioRequisicao {
  id: string;
  permissoes: string[];
}

/** Injeta o usuário autenticado (preenchido pelo JwtAuthGuard). */
export const UsuarioAtual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioRequisicao => {
    return ctx.switchToHttp().getRequest().usuario;
  },
);
