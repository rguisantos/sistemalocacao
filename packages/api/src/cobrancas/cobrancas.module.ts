import { Module } from '@nestjs/common';
import { CobrancasController } from './cobrancas.controller';
import { CobrancasService } from './cobrancas.service';
import { SaldoService } from './saldo.service';

@Module({ controllers: [CobrancasController], providers: [CobrancasService, SaldoService], exports: [SaldoService] })
export class CobrancasModule {}
