import { Module } from '@nestjs/common';
import { SaldoDevedorController } from './saldo-devedor.controller';
import { SaldoDevedorService } from './saldo-devedor.service';
import { CobrancasModule } from '../cobrancas/cobrancas.module';

@Module({
  imports: [CobrancasModule],          // usa o SaldoService exportado
  controllers: [SaldoDevedorController],
  providers: [SaldoDevedorService],
})
export class SaldoDevedorModule {}
