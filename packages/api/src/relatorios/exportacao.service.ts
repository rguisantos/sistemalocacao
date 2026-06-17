import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/** Geração de relatórios em Excel e PDF (padrão reutilizável por todos os relatórios). */
@Injectable()
export class ExportacaoService {
  async excel(titulo: string, colunas: string[], linhas: (string | number)[][]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(titulo.slice(0, 31));
    ws.addRow([titulo]); ws.addRow([]);
    ws.addRow(colunas); ws.getRow(3).font = { bold: true };
    linhas.forEach((l) => ws.addRow(l));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  pdf(titulo: string, colunas: string[], linhas: (string | number)[][]): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.fontSize(16).text(titulo, { underline: false }); doc.moveDown();
      doc.fontSize(10).text(colunas.join('   |   ')); doc.moveDown(0.5);
      linhas.forEach((l) => doc.fontSize(10).text(l.join('   |   ')));
      doc.end();
    });
  }
}
