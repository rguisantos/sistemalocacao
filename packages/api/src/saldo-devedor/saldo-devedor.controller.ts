import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
  listar(@Query('clienteId') clienteId: string) {
    return this.servico.listarPendentesDoCliente(clienteId);
  }

  @Post(':id/pagar')
  @RequerPermissoes('cobrancas.criar')
  pagar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: PagarSaldoDto, @Req() req: any) {
    return this.servico.pagar(u, id, dto, req.ip);
  }
}
