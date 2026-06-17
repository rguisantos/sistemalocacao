import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EnderecosService } from './enderecos.service';
import { CriarEnderecoDto, AtualizarEnderecoDto } from './dto/endereco.dto';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('enderecos') @ApiBearerAuth() @Controller('enderecos')
export class EnderecosController {
  constructor(private readonly s: EnderecosService) {}
  @Get() @RequerPermissoes('clientes.ler')
  listar(@UsuarioAtual() u: UsuarioRequisicao, @Query('clienteId') clienteId: string) { return this.s.listarDoCliente(u, clienteId); }
  @Post() @RequerPermissoes('clientes.editar')
  criar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: CriarEnderecoDto, @Req() r: any) { return this.s.criar(u, dto, r.ip); }
  @Patch(':id') @RequerPermissoes('clientes.editar')
  atualizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AtualizarEnderecoDto, @Req() r: any) { return this.s.atualizar(u, id, dto, r.ip); }
  @Delete(':id') @RequerPermissoes('clientes.editar')
  remover(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Req() r: any) { return this.s.remover(u, id, r.ip); }
}
