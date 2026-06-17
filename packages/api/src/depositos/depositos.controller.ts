import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DepositosService } from './depositos.service';
import { CriarDepositoDto, AtualizarDepositoDto } from './dto/deposito.dto';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('depositos') @ApiBearerAuth() @Controller('depositos')
export class DepositosController {
  constructor(private readonly s: DepositosService) {}
  @Get() @RequerPermissoes('depositos.ler') listar() { return this.s.listar(); }
  @Get(':id') @RequerPermissoes('depositos.ler') obter(@Param('id') id: string) { return this.s.obter(id); }
  @Post() @RequerPermissoes('depositos.criar')
  criar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: CriarDepositoDto, @Req() r: any) { return this.s.criar(u, { ...dto }, r.ip); }
  @Patch(':id') @RequerPermissoes('depositos.editar')
  atualizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AtualizarDepositoDto, @Req() r: any) {
    const { version, ...dados } = dto; return this.s.atualizar(u, id, dados, version, r.ip);
  }
  @Delete(':id') @RequerPermissoes('depositos.excluir')
  remover(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Req() r: any) { return this.s.remover(u, id, r.ip); }
}
