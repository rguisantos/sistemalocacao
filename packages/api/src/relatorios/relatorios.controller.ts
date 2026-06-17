import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { RelatoriosService } from './relatorios.service';
import { ExportacaoService } from './exportacao.service';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';

@ApiTags('relatorios') @ApiBearerAuth() @Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly rel: RelatoriosService, private readonly exp: ExportacaoService) {}

  @Get('dashboard') @RequerPermissoes('relatorios.ler')
  dashboard() { return this.rel.dashboard(); }

  @Get('faturamento-por-rota') @RequerPermissoes('relatorios.ler')
  faturamentoPorRota(@Query('de') de: string, @Query('ate') ate: string) {
    return this.rel.faturamentoPorRota(new Date(de), new Date(ate));
  }

  @Get('inadimplencia') @RequerPermissoes('relatorios.ler')
  inadimplencia() { return this.rel.inadimplencia(); }

  // Exportação (padrão): ?formato=pdf|excel
  @Get('faturamento-por-rota/exportar') @RequerPermissoes('relatorios.exportar_pdf')
  async exportar(@Query('de') de: string, @Query('ate') ate: string, @Query('formato') formato: string, @Res() res: Response) {
    const dados = await this.rel.faturamentoPorRota(new Date(de), new Date(ate));
    const colunas = ['Rota', 'Faturamento (R$)'];
    const linhas = dados.map((d) => [d.rota, d.valor]);
    if (formato === 'excel') {
      const buf = await this.exp.excel('Faturamento por rota', colunas, linhas);
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="faturamento-por-rota.xlsx"' });
      return res.send(buf);
    }
    const buf = await this.exp.pdf('Faturamento por rota', colunas, linhas);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="faturamento-por-rota.pdf"' });
    return res.send(buf);
  }
}
