import * as crypto from 'crypto';

/**
 * Criptografia simétrica para segredos em repouso (decisão da auditoria — P1).
 * AES-256-GCM com chave derivada de CONFIG_SECRET (env). Formato: iv:tag:cipher (base64).
 */
function chave(): Buffer {
  const s = process.env.CONFIG_SECRET;
  if (!s || s.length < 32) throw new Error('CONFIG_SECRET ausente ou fraco (>= 32 chars).');
  return crypto.createHash('sha256').update(s).digest(); // 32 bytes
}

export function criptografar(texto: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const enc = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function descriptografar(payload: string): string {
  const [iv, tag, enc] = payload.split(':').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
