import { Module } from '@nestjs/common';
import { LocacoesController } from './locacoes.controller';
import { LocacoesService } from './locacoes.service';

@Module({ controllers: [LocacoesController], providers: [LocacoesService], exports: [LocacoesService] })
export class LocacoesModule {}
