import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LIMITES_PADRAO } from '@app/core';
import { SyncService } from './sync.service';
import { PullDto, PushDto } from './dto/sync.dto';
import { RateLimit } from '../comum/decorators/rate-limit.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('pull')
  @HttpCode(200)
  @RateLimit(LIMITES_PADRAO.sync)                 // [AUDIT P0] rate limit persistente
  @ApiOperation({ summary: 'Baixa mudanças (incremental, com tombstones, relógio do servidor)' })
  pull(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: PullDto) {
    return this.sync.pull(u, dto.lastPulledAt ?? null, dto.fullSync);
  }

  @Post('push')
  @HttpCode(200)
  @RateLimit(LIMITES_PADRAO.sync)
  @ApiOperation({ summary: 'Envia mudanças locais (allowlist, idempotente, resolução de conflito)' })
  push(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: PushDto) {
    return this.sync.push(u, dto.idempotencyKey, dto.mudancas);
  }
}
