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
  dashboard(
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('rotaId') rotaId?: string,
  ) {
    return this.rel.dashboard(de ? new Date(de) : undefined, ate ? new Date(ate) : undefined, rotaId || undefined);
  }

  @Get('faturamento-por-rota') @RequerPermissoes('relatorios.ler')
  faturamentoPorRota(@Query('de') de: string, @Query('ate') ate: string, @Query('rotaId') rotaId?: string) {
    return this.rel.faturamentoPorRota(new Date(de), new Date(ate), rotaId || undefined);
  }

  @Get('inadimplencia') @RequerPermissoes('relatorios.ler')
  inadimplencia() { return this.rel.inadimplencia(); }

  @Get('locacoes') @RequerPermissoes('relatorios.ler')
  locacoes(@Query('de') de?: string, @Query('ate') ate?: string, @Query('rotaId') rotaId?: string) {
    return this.rel.locacoes(de ? new Date(de) : undefined, ate ? new Date(ate) : undefined, rotaId || undefined);
  }

  @Get('produtos') @RequerPermissoes('relatorios.ler')
  produtos() { return this.rel.produtos(); }

  @Get('produtos-por-rota') @RequerPermissoes('relatorios.ler')
  produtosPorRota(@Query('rotaId') rotaId?: string) { return this.rel.produtosPorRota(rotaId || undefined); }

  @Get('clientes') @RequerPermissoes('relatorios.ler')
  clientes(@Query('rotaId') rotaId?: string) { return this.rel.clientes(rotaId || undefined); }

  @Get('recebimentos') @RequerPermissoes('relatorios.ler')
  recebimentos(@Query('de') de?: string, @Query('ate') ate?: string, @Query('rotaId') rotaId?: string) {
    return this.rel.recebimentos(de ? new Date(de) : undefined, ate ? new Date(ate) : undefined, rotaId || undefined);
  }

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
