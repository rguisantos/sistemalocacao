import { Module } from '@nestjs/common';
import { DepositosController } from './depositos.controller';
import { DepositosService } from './depositos.service';
@Module({ controllers: [DepositosController], providers: [DepositosService] })
export class DepositosModule {}
