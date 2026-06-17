import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { CobrancasModule } from '../cobrancas/cobrancas.module';

@Module({
  imports: [CobrancasModule],          // usa SaldoService para recálculo
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
