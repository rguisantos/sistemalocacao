import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RotasService } from './rotas.service';
import { CriarRotaDto, AtualizarRotaDto } from './dto/rota.dto';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('rotas') @ApiBearerAuth() @Controller('rotas')
export class RotasController {
  constructor(private readonly s: RotasService) {}
  @Get() @RequerPermissoes('rotas.ler') listar() { return this.s.listar(); }
  @Get(':id') @RequerPermissoes('rotas.ler') obter(@Param('id') id: string) { return this.s.obter(id); }
  @Post() @RequerPermissoes('rotas.criar')
  criar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: CriarRotaDto, @Req() r: any) { return this.s.criar(u, { ...dto }, r.ip); }
  @Patch(':id') @RequerPermissoes('rotas.editar')
  atualizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AtualizarRotaDto, @Req() r: any) {
    const { version, ...dados } = dto; return this.s.atualizar(u, id, dados, version, r.ip);
  }
  @Delete(':id') @RequerPermissoes('rotas.excluir')
  remover(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Req() r: any) { return this.s.remover(u, id, r.ip); }
}
