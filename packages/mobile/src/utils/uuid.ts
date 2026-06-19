/**
 * UUID v4 síncrono compatível com React Native.
 *
 * O pacote `uuid` usa `crypto.getRandomValues()` que não existe no
 * React Native, causando o erro "crypto.getRandomValues() not supported".
 * Esta implementação usa Math.random() — suficiente para IDs locais
 * de cobrança/pagamento/sync (não criptográfico).
 */
export function v4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
