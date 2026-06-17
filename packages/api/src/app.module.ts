import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuditoriaModule } from './comum/auditoria/auditoria.module';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { EnderecosModule } from './enderecos/enderecos.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { RotasModule } from './rotas/rotas.module';
import { DepositosModule } from './depositos/depositos.module';
import { AuxiliaresModule } from './auxiliares/auxiliares.module';
import { ProdutosModule } from './produtos/produtos.module';
import { LocacoesModule } from './locacoes/locacoes.module';
import { CobrancasModule } from './cobrancas/cobrancas.module';
import { SaldoDevedorModule } from './saldo-devedor/saldo-devedor.module';
import { SyncModule } from './sync/sync.module';
import { IntegracaoModule } from './integracao/integracao.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { RateLimitGuard } from './comum/guards/rate-limit.guard';
import { JwtAuthGuard } from './comum/guards/jwt-auth.guard';
import { PermissoesGuard } from './comum/guards/permissoes.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule, RedisModule, AuditoriaModule,
    AuthModule, UsuariosModule, RotasModule, DepositosModule, AuxiliaresModule,
    ProdutosModule, ClientesModule, EnderecosModule,
    LocacoesModule, CobrancasModule, SaldoDevedorModule, SyncModule,
    IntegracaoModule, RelatoriosModule, NotificacoesModule,
  ],
  providers: [
    // Ordem importa: rate limit -> autenticação -> autorização.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissoesGuard },
  ],
})
export class AppModule {}
