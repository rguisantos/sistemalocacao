import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CobrancasService } from './cobrancas.service';
import { RegistrarCobrancaDto } from './dto/registrar-cobranca.dto';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('cobrancas')
@ApiBearerAuth()
@Controller('cobrancas')
export class CobrancasController {
  constructor(private readonly cobrancas: CobrancasService) {}

  @Post()
  @RequerPermissoes('cobrancas.criar')
  @ApiOperation({ summary: 'Registra uma cobrança (cálculo + pagamento append-only + saldo derivado)' })
  registrar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: RegistrarCobrancaDto, @Req() req: any) {
    return this.cobrancas.registrar(u, dto, req.ip);
  }
}
