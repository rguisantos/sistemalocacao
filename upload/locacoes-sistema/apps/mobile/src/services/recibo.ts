import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatarBRL, type PassoCalculo } from '@locacoes/shared';

export interface DadosRecibo {
  empresa: string;
  cliente: string;
  produto: string;
  data: Date;
  passos: PassoCalculo[];
  valorPago: string;
  formaPagamento: string;
  cobrador: string;
  trocaPano?: boolean;
}

export async function gerarReciboPDF(d: DadosRecibo) {
  const linhas = d.passos
    .map((p) => `<tr><td>${p.descricao}</td><td style="text-align:right">${p.valor}</td></tr>`)
    .join('');

  const html = `
    <html><head><meta charset="utf-8"><style>
      body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; }
      h1 { font-size: 14px; text-align: center; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 2px 0; }
      .total { border-top: 1px dashed #000; font-weight: bold; }
      .rodape { text-align: center; margin-top: 12px; font-size: 10px; }
    </style></head><body>
      <h1>${d.empresa}</h1>
      <p>Cliente: ${d.cliente}<br>Produto: ${d.produto}<br>
      Data: ${d.data.toLocaleString('pt-BR')}</p>
      <table>${linhas}
        <tr class="total"><td>Pago (${d.formaPagamento})</td>
        <td style="text-align:right">${formatarBRL(d.valorPago)}</td></tr>
      </table>
      <p>Troca de pano: ${d.trocaPano ? 'SIM' : 'não'}</p>
      <p class="rodape">Cobrador: ${d.cobrador}<br>Obrigado!</p>
    </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, width: 300 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
  }
  return uri;
}

/**
 * Texto formatado para impressora térmica ESC/POS (32 colunas).
 * Envio Bluetooth requer lib nativa (ex.: react-native-bluetooth-escpos-printer)
 * adicionada via expo prebuild — função retorna o buffer de texto pronto.
 */
export function gerarReciboESCPOS(d: DadosRecibo): string {
  const LARGURA = 32;
  const linha = (esq: string, dir: string) =>
    esq.slice(0, LARGURA - dir.length - 1).padEnd(LARGURA - dir.length) + dir;
  const sep = '-'.repeat(LARGURA);

  const partes = [
    d.empresa.slice(0, LARGURA).padStart((LARGURA + d.empresa.length) / 2),
    sep,
    `Cliente: ${d.cliente}`.slice(0, LARGURA),
    `Produto: ${d.produto}`.slice(0, LARGURA),
    `Data: ${d.data.toLocaleString('pt-BR')}`,
    sep,
    ...d.passos.map((p) => linha(p.descricao, p.valor)),
    sep,
    linha(`Pago (${d.formaPagamento})`, formatarBRL(d.valorPago)),
    sep,
    `Troca de pano: ${d.trocaPano ? 'SIM' : 'nao'}`,
    `Cobrador: ${d.cobrador}`,
    '\n\n\n',
  ];
  return partes.join('\n');
}
