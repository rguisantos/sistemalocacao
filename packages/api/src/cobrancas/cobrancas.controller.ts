import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CobrancasService } from './cobrancas.service';
import { RegistrarCobrancaDto } from './dto/registrar-cobranca.dto';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('cobrancas')
@ApiBearerAuth()
@Controller('cobrancas')
export class CobrancasController {
  constructor(private readonly cobrancas: CobrancasService) {}

  @Get()
  @RequerPermissoes('cobrancas.ler')
  @ApiOperation({ summary: 'Lista cobranças com filtros e paginação' })
  @ApiQuery({ name: 'clienteId', required: false })
  @ApiQuery({ name: 'locacaoId', required: false })
  @ApiQuery({ name: 'statusPagamento', required: false })
  @ApiQuery({ name: 'dataInicio', required: false })
  @ApiQuery({ name: 'dataFim', required: false })
  @ApiQuery({ name: 'pagina', required: false })
  @ApiQuery({ name: 'limite', required: false })
  listar(
    @Query('clienteId') clienteId?: string,
    @Query('locacaoId') locacaoId?: string,
    @Query('statusPagamento') statusPagamento?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('pagina') pagina = '1',
    @Query('limite') limite = '20',
  ) {
    return this.cobrancas.listar({
      clienteId, locacaoId, statusPagamento,
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
      pagina: Number(pagina),
      limite: Number(limite),
    });
  }

  @Get('resumo')
  @RequerPermissoes('cobrancas.ler')
  @ApiOperation({ summary: 'Resumo financeiro: totais por status, por forma de pagamento, evolução mensal' })
  @ApiQuery({ name: 'clienteId', required: false })
  @ApiQuery({ name: 'dataInicio', required: false })
  @ApiQuery({ name: 'dataFim', required: false })
  resumo(
    @Query('clienteId') clienteId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.cobrancas.resumo({
      clienteId,
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
    });
  }

  @Get(':id')
  @RequerPermissoes('cobrancas.ler')
  @ApiOperation({ summary: 'Detalha uma cobrança com pagamentos, locação, cliente e memorial' })
  obter(@Param('id') id: string) {
    return this.cobrancas.obter(id);
  }

  @Post()
  @RequerPermissoes('cobrancas.criar')
  @ApiOperation({ summary: 'Registra uma cobrança (cálculo + pagamento append-only + saldo derivado)' })
  registrar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: RegistrarCobrancaDto, @Req() req: any) {
    return this.cobrancas.registrar(u, dto, req.ip);
  }
}
