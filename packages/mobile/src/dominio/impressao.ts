import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { DadosRecibo, reciboHtml, reciboEscPos } from './recibo';

/** Gera o PDF do recibo e abre o compartilhamento (visualizar/enviar). */
export async function gerarReciboPdf(d: DadosRecibo): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: reciboHtml(d) });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  return uri;
}

/** base64 seguro em React Native (sem depender de btoa, sem estourar a pilha). */
function bytesParaBase64(bytes: Uint8Array): string {
  const tabela = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let saida = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    saida += tabela[b0 >> 2];
    saida += tabela[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    saida += b1 === undefined ? '=' : tabela[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    saida += b2 === undefined ? '=' : tabela[b2 & 63];
  }
  return saida;
}

/**
 * Impressão térmica Bluetooth (ESC/POS, papel 58/60mm).
 * Usa react-native-thermal-receipt-printer (exige Expo Dev Client + impressora pareada).
 * Import dinâmico para não quebrar no Expo Go.
 */
export async function imprimirReciboTermico(d: DadosRecibo, enderecoImpressora: string): Promise<void> {
  const { BLEPrinter } = await import('react-native-thermal-receipt-printer');
  await BLEPrinter.init();
  await BLEPrinter.connectPrinter(enderecoImpressora);
  const bytes = reciboEscPos(d);
  const base64 = bytesParaBase64(bytes);
  // @ts-ignore — printRaw existe nas versões com suporte a ESC/POS cru (base64)
  if (typeof BLEPrinter.printRaw === 'function') BLEPrinter.printRaw(base64);
  // @ts-ignore — fallback: algumas versões aceitam bytes crus via printBill com flag
  else BLEPrinter.printBill(base64, { encoding: 'Base64' });
}
