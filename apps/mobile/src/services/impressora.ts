// Impressão térmica Bluetooth ESC/POS com degradação graciosa.
//
// Caminho nativo: requer `react-native-bluetooth-escpos-printer`
// (adicionar após `npx expo prebuild`). O import é dinâmico: se a lib
// não estiver instalada (ex.: Expo Go), cai no fallback de PDF.
//
//   npx expo prebuild
//   npm i react-native-bluetooth-escpos-printer
//   (permissões BLUETOOTH_CONNECT/SCAN já declaradas no app.json)
import { Alert } from 'react-native';
import { gerarReciboESCPOS, gerarReciboPDF, type DadosRecibo } from './recibo';

interface ModuloBluetooth {
  BluetoothManager: {
    isBluetoothEnabled(): Promise<boolean>;
    scanDevices(): Promise<string>;
    connect(address: string): Promise<void>;
  };
  BluetoothEscposPrinter: {
    printText(text: string, opts: Record<string, unknown>): Promise<void>;
  };
}

let modulo: ModuloBluetooth | null | undefined; // undefined = ainda não tentou

function carregarModulo(): ModuloBluetooth | null {
  if (modulo !== undefined) return modulo;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    modulo = require('react-native-bluetooth-escpos-printer');
  } catch {
    modulo = null; // lib não instalada (Expo Go / build sem o módulo)
  }
  // ?? null: o TS não estreita `let` de escopo de módulo após o try/catch
  return modulo ?? null;
}

let enderecoImpressora: string | null = null;

export function impressoraDisponivel(): boolean {
  return carregarModulo() !== null;
}

export async function parearImpressora(): Promise<string[]> {
  const m = carregarModulo();
  if (!m) throw new Error('Módulo Bluetooth não instalado neste build.');
  const ligado = await m.BluetoothManager.isBluetoothEnabled();
  if (!ligado) throw new Error('Ative o Bluetooth do aparelho.');
  const resultado = await m.BluetoothManager.scanDevices();
  const { paired = [] } = JSON.parse(resultado || '{}');
  return paired.map((d: { address: string; name: string }) => `${d.name}|${d.address}`);
}

export async function conectarImpressora(endereco: string) {
  const m = carregarModulo();
  if (!m) throw new Error('Módulo Bluetooth não instalado neste build.');
  await m.BluetoothManager.connect(endereco);
  enderecoImpressora = endereco;
}

/**
 * Imprime o recibo na térmica se houver módulo + impressora conectada;
 * caso contrário, gera PDF e abre o compartilhamento.
 */
export async function imprimirRecibo(dados: DadosRecibo): Promise<'termica' | 'pdf'> {
  const m = carregarModulo();
  if (m && enderecoImpressora) {
    try {
      await m.BluetoothEscposPrinter.printText(gerarReciboESCPOS(dados), {});
      return 'termica';
    } catch (e) {
      Alert.alert('Falha na impressora', 'Gerando PDF como alternativa.');
    }
  }
  await gerarReciboPDF(dados);
  return 'pdf';
}
