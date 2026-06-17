import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CriarUsuarioDto, AtualizarUsuarioDto, DefinirPermissoesDto } from './dto/usuario.dto';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('usuarios') @ApiBearerAuth() @Controller('usuarios')
export class UsuariosController {
  constructor(private readonly s: UsuariosService) {}
  @Get() @RequerPermissoes('admin.usuarios.ler') listar() { return this.s.listar(); }
  @Get('catalogo-permissoes') @RequerPermissoes('admin.usuarios.ler') catalogo() { return this.s.catalogo(); }
  @Get(':id') @RequerPermissoes('admin.usuarios.ler') obter(@Param('id') id: string) { return this.s.obter(id); }
  @Post() @RequerPermissoes('admin.usuarios.criar')
  criar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: CriarUsuarioDto, @Req() r: any) { return this.s.criar(u, dto, r.ip); }
  @Patch(':id') @RequerPermissoes('admin.usuarios.editar')
  atualizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AtualizarUsuarioDto, @Req() r: any) { return this.s.atualizar(u, id, dto, r.ip); }
  @Patch(':id/permissoes') @RequerPermissoes('admin.permissoes.atribuir')
  permissoes(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: DefinirPermissoesDto, @Req() r: any) { return this.s.definirPermissoes(u, id, dto, r.ip); }
  @Delete(':id') @RequerPermissoes('admin.usuarios.excluir')
  remover(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Req() r: any) { return this.s.remover(u, id, r.ip); }
}
