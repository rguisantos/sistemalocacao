import { Body, Controller, Post, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LIMITES_PADRAO } from '@app/core/server';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Publico } from '../comum/decorators/publico.decorator';
import { RateLimit } from '../comum/decorators/rate-limit.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly auditoria: AuditoriaService) {}

  @Publico()
  @RateLimit(LIMITES_PADRAO.auth)          // [AUDIT P0] brute-force protection
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login por CPF e senha' })
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const r = await this.auth.login(dto.cpf, dto.senha);
    await this.auditoria.registrar({
      usuarioId: r.usuario.id, acao: 'LOGIN', entidade: 'Usuario',
      entidadeId: r.usuario.id, ip: req.ip,
    });
    return r;
  }

  @Publico()
  @RateLimit(LIMITES_PADRAO.auth)
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renova o access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Logout global (revoga todos os tokens do usuário)' })
  async logout(@UsuarioAtual() usuario: UsuarioRequisicao) {
    await this.auth.logoutGlobal(usuario.id);
  }
}
