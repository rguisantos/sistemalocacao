import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CriarClienteDto } from './dto/criar-cliente.dto';
import { AtualizarClienteDto } from './dto/atualizar-cliente.dto';
import { TransferirRotaDto } from './dto/transferir-rota.dto';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('clientes')
@ApiBearerAuth()
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  @RequerPermissoes('clientes.ler')
  @ApiOperation({ summary: 'Lista clientes (restritos às rotas do usuário)' })
  listar(@UsuarioAtual() u: UsuarioRequisicao) {
    return this.clientes.listar(u);
  }

  @Get('mapa')
  @RequerPermissoes('clientes.ler')
  @ApiOperation({ summary: 'Pontos geolocalizados dos clientes (uma query, escopado por rota)' })
  mapa(@UsuarioAtual() u: UsuarioRequisicao) {
    return this.clientes.mapa(u);
  }

  @Get(':id')
  @RequerPermissoes('clientes.ler')
  obter(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string) {
    return this.clientes.obter(u, id);
  }

  @Post()
  @RequerPermissoes('clientes.criar')
  criar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: CriarClienteDto, @Req() req: any) {
    return this.clientes.criar(u, dto, req.ip);
  }

  @Patch(':id')
  @RequerPermissoes('clientes.editar')
  atualizar(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: AtualizarClienteDto, @Req() req: any) {
    return this.clientes.atualizar(u, id, dto, req.ip);
  }

  @Delete(':id')
  @RequerPermissoes('clientes.excluir')
  remover(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Req() req: any) {
    return this.clientes.remover(u, id, req.ip);
  }

  @Patch(':id/transferir-rota')
  @RequerPermissoes('clientes.transferir_rota')
  transferir(@UsuarioAtual() u: UsuarioRequisicao, @Param('id') id: string, @Body() dto: TransferirRotaDto, @Req() req: any) {
    return this.clientes.transferirRota(u, id, dto.rotaId, dto.version, req.ip);
  }
}
