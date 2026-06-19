import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SaldoDevedorService } from './saldo-devedor.service';
import { PagarSaldoDto } from './dto/pagar-saldo.dto';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('saldo-devedor')
@ApiBearerAuth()
@Controller('saldo-devedor')
export class SaldoDevedorController {
  constructor(private readonly servico: SaldoDevedorService) {}

  @Get()
  @RequerPermissoes('cobrancas.ler')
  @ApiOperation({ summary: 'Lista saldos devedores pendentes com paginação e filtros' })
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
    return this.servico.listar({
      clienteId, status,
      pagina: Number(pagina), limite: Number(limite),
    });
  }

  @Get(':id')
  @RequerPermissoes('cobrancas.ler')
  @ApiOperation({ summary: 'Detalha um saldo devedor com pagamentos' })
  obter(@Param('id') id: string) {
    return this.servico.obter(id);
  }

  @Post(':id/pagar')
  @RequerPermissoes('cobrancas.criar')
  pagar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: PagarSaldoDto, @Req() req: any) {
    return this.servico.pagar(u, id, dto, req.ip);
  }
}
