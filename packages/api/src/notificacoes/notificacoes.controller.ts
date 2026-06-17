import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificacoesService } from './notificacoes.service';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';

@ApiTags('notificacoes') @ApiBearerAuth() @Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly s: NotificacoesService) {}

  @Post('enviar') @RequerPermissoes('admin.usuarios.editar')
  enviar(@Body() body: { usuarioIds: string[]; titulo: string; corpo: string }) {
    return this.s.enviarManual(body.usuarioIds, body.titulo, body.corpo);
  }

  @Post('verificar-inadimplencia') @RequerPermissoes('admin.usuarios.editar')
  verificar() { return this.s.verificarInadimplencia(); } // disparo manual do job
}
