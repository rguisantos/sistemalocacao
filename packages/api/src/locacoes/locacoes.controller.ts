import { Body, Controller, Param, Patch, Post, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LocacoesService } from './locacoes.service';
import { CriarLocacaoDto } from './dto/criar-locacao.dto';
import { AtualizarLocacaoDto } from './dto/atualizar-locacao.dto';
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
  @ApiOperation({ summary: 'Lista locações com filtros e paginação' })
  @ApiQuery({ name: 'clienteId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'pagina', required: false })
  @ApiQuery({ name: 'limite', required: false })
  listar(
    @Query('clienteId') clienteId?: string,
    @Query('status') status?: string,
    @Query('pagina') pagina = '1',
    @Query('limite') limite = '20',
  ) {
    return this.locacoes.listar({
      clienteId,
      status,
      pagina: Number(pagina),
      limite: Number(limite),
    });
  }

  @Get(':id')
  @RequerPermissoes('locacoes.ler')
  @ApiOperation({ summary: 'Detalha uma locação com cobranças e pagamentos' })
  obter(@Param('id') id: string) {
    return this.locacoes.obter(id);
  }

  @Get(':id/contexto-cobranca')
  @RequerPermissoes('cobrancas.ler')
  contexto(@Param('id') id: string) {
    return this.locacoes.contextoCobranca(id);
  }

  @Patch(':id')
  @RequerPermissoes('locacoes.editar')
  @ApiOperation({ summary: 'Edita parâmetros da locação (regra atual, endereço, início)' })
  atualizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AtualizarLocacaoDto, @Req() req: any) {
    return this.locacoes.atualizar(u, id, dto, req.ip);
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
