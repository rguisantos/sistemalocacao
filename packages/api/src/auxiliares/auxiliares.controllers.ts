import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TiposProdutoService, TamanhosService, CondicoesService, CoresService } from './auxiliares.services';
import { CriarTipoDto, AtualizarTipoDto, CriarDescricaoDto, AtualizarDescricaoDto } from './dto/auxiliares.dto';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('auxiliares') @ApiBearerAuth() @Controller('tipos-produto')
export class TiposProdutoController {
  constructor(private readonly s: TiposProdutoService) {}
  @Get() @RequerPermissoes('auxiliares.tipos.ler') listar() { return this.s.listar(); }
  @Post() @RequerPermissoes('auxiliares.tipos.criar')
  criar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: CriarTipoDto, @Req() r: any) { return this.s.criar(u, { ...dto }, r.ip); }
  @Patch(':id') @RequerPermissoes('auxiliares.tipos.editar')
  atualizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AtualizarTipoDto, @Req() r: any) {
    const { version, ...d } = dto; return this.s.atualizar(u, id, d, version, r.ip);
  }
  @Delete(':id') @RequerPermissoes('auxiliares.tipos.excluir')
  remover(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Req() r: any) { return this.s.remover(u, id, r.ip); }
}

@ApiTags('auxiliares') @ApiBearerAuth() @Controller('tamanhos')
export class TamanhosController {
  constructor(private readonly s: TamanhosService) {}
  @Get() @RequerPermissoes('auxiliares.tamanhos.ler') listar() { return this.s.listar(); }
  @Post() @RequerPermissoes('auxiliares.tamanhos.criar')
  criar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: CriarDescricaoDto, @Req() r: any) { return this.s.criar(u, { ...dto }, r.ip); }
  @Patch(':id') @RequerPermissoes('auxiliares.tamanhos.editar')
  atualizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AtualizarDescricaoDto, @Req() r: any) {
    const { version, ...d } = dto; return this.s.atualizar(u, id, d, version, r.ip);
  }
  @Delete(':id') @RequerPermissoes('auxiliares.tamanhos.excluir')
  remover(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Req() r: any) { return this.s.remover(u, id, r.ip); }
}

@ApiTags('auxiliares') @ApiBearerAuth() @Controller('condicoes')
export class CondicoesController {
  constructor(private readonly s: CondicoesService) {}
  @Get() @RequerPermissoes('auxiliares.condicoes.ler') listar() { return this.s.listar(); }
  @Post() @RequerPermissoes('auxiliares.condicoes.criar')
  criar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: CriarDescricaoDto, @Req() r: any) { return this.s.criar(u, { ...dto }, r.ip); }
  @Patch(':id') @RequerPermissoes('auxiliares.condicoes.editar')
  atualizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AtualizarDescricaoDto, @Req() r: any) {
    const { version, ...d } = dto; return this.s.atualizar(u, id, d, version, r.ip);
  }
  @Delete(':id') @RequerPermissoes('auxiliares.condicoes.excluir')
  remover(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Req() r: any) { return this.s.remover(u, id, r.ip); }
}

@ApiTags('auxiliares') @ApiBearerAuth() @Controller('cores')
export class CoresController {
  constructor(private readonly s: CoresService) {}
  @Get() @RequerPermissoes('auxiliares.cores.ler') listar() { return this.s.listar(); }
  @Post() @RequerPermissoes('auxiliares.cores.criar')
  criar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: CriarTipoDto, @Req() r: any) { return this.s.criar(u, { ...dto }, r.ip); }
  @Patch(':id') @RequerPermissoes('auxiliares.cores.editar')
  atualizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AtualizarTipoDto, @Req() r: any) {
    const { version, ...d } = dto; return this.s.atualizar(u, id, d, version, r.ip);
  }
  @Delete(':id') @RequerPermissoes('auxiliares.cores.excluir')
  remover(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Req() r: any) { return this.s.remover(u, id, r.ip); }
}
