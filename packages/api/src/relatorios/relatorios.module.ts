import { Module } from '@nestjs/common';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';
import { ExportacaoService } from './exportacao.service';

@Module({ controllers: [RelatoriosController], providers: [RelatoriosService, ExportacaoService] })
export class RelatoriosModule {}
