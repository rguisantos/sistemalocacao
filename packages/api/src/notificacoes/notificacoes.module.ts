import { Module } from '@nestjs/common';
import { NotificacoesController } from './notificacoes.controller';
import { NotificacoesService } from './notificacoes.service';
import { ExpoPushService } from './expo-push.service';
import { IntegracaoModule } from '../integracao/integracao.module';

@Module({
  imports: [IntegracaoModule],         // ConfiguracaoService
  controllers: [NotificacoesController],
  providers: [NotificacoesService, ExpoPushService],
})
export class NotificacoesModule {}
