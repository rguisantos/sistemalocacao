import { Body, Controller, Param, Post, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LocacoesService } from './locacoes.service';
import { CriarLocacaoDto } from './dto/criar-locacao.dto';
import { FinalizarLocacaoDto } from './dto/finalizar-locacao.dto';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('locacoes')
@ApiBearerAuth()
@Controller('locacoes')
export class LocacoesController {
  constructor(private readonly locacoes: LocacoesService) {}

  @Get()
  @RequerPermissoes('locacoes.ler')
  listar(@Query('clienteId') clienteId: string) {
    return this.locacoes.listarAtivasDoCliente(clienteId);
  }

  @Get(':id/contexto-cobranca')
  @RequerPermissoes('cobrancas.ler')
  contexto(@Param('id') id: string) {
    return this.locacoes.contextoCobranca(id);
  }

  @Post()
  @RequerPermissoes('locacoes.criar')
  criar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: CriarLocacaoDto, @Req() req: any) {
    return this.locacoes.criar(u, dto, req.ip);
  }

  @Post(':id/finalizar')
  finalizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: FinalizarLocacaoDto, @Req() req: any) {
    return this.locacoes.finalizar(u, id, dto, req.ip);
  }
}
