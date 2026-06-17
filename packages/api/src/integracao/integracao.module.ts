import { Module } from '@nestjs/common';
import { IntegracaoController } from './integracao.controller';
import { MercadoPagoService } from './mercadopago.service';
import { ConfiguracaoService } from './configuracao.service';
import { CobrancasModule } from '../cobrancas/cobrancas.module';

@Module({
  imports: [CobrancasModule],          // SaldoService
  controllers: [IntegracaoController],
  providers: [MercadoPagoService, ConfiguracaoService],
  exports: [ConfiguracaoService],
})
export class IntegracaoModule {}
