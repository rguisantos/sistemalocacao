import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';
import { RequerPermissoes } from '../decorators/permissoes.decorator';

@ApiTags('auditoria') @ApiBearerAuth() @Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly s: AuditoriaService) {}

  @Get() @RequerPermissoes('admin.auditoria.ler')
  listar(@Query('entidade') entidade?: string, @Query('usuarioId') usuarioId?: string,
         @Query('de') de?: string, @Query('ate') ate?: string, @Query('pagina') pagina?: string) {
    return this.s.listar({ entidade, usuarioId, de, ate, pagina: pagina ? Number(pagina) : 1 });
  }
}
