import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProdutosService } from './produtos.service';
import { CriarProdutoDto, AtualizarProdutoDto, AlterarContadorDto } from './dto/produto.dto';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('produtos') @ApiBearerAuth() @Controller('produtos')
export class ProdutosController {
  constructor(private readonly s: ProdutosService) {}

  @Get() @RequerPermissoes('produtos.ler') listar() { return this.s.listar(); }
  @Get('em-deposito') @RequerPermissoes('produtos.ler') emDeposito() { return this.s.listarEmDeposito(); }
  @Get(':id') @RequerPermissoes('produtos.ler') obter(@Param('id') id: string) { return this.s.obter(id); }

  @Post() @RequerPermissoes('produtos.criar')
  criar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: CriarProdutoDto, @Req() r: any) { return this.s.criar(u, { ...dto }, r.ip); }

  @Patch(':id') @RequerPermissoes('produtos.editar')
  atualizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AtualizarProdutoDto, @Req() r: any) {
    const { version, ...dados } = dto; return this.s.atualizar(u, id, dados, version, r.ip);
  }

  // Endpoint separado: alterar contador exige permissão própria. [spec: produtos.alterar_contador]
  @Patch(':id/contador') @RequerPermissoes('produtos.alterar_contador')
  contador(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AlterarContadorDto, @Req() r: any) {
    return this.s.alterarContador(u, id, dto.contador, dto.version, r.ip);
  }

  @Delete(':id') @RequerPermissoes('produtos.excluir')
  remover(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Req() r: any) { return this.s.remover(u, id, r.ip); }
}
