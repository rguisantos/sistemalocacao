import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const K_ACCESS = 'accessToken', K_REFRESH = 'refreshToken';
const K_USER = 'usuarioSessao', K_OFFLINE = 'credOffline';

export interface SessaoUsuario { id: string; nome: string; permissoes: string[]; cpf: string; }

export async function salvarSessao(s: { accessToken: string; refreshToken: string; usuario: SessaoUsuario }) {
  await SecureStore.setItemAsync(K_ACCESS, s.accessToken);
  await SecureStore.setItemAsync(K_REFRESH, s.refreshToken);
  await SecureStore.setItemAsync(K_USER, JSON.stringify(s.usuario));
}
export async function obterToken() { return SecureStore.getItemAsync(K_ACCESS); }
export async function obterSessao(): Promise<SessaoUsuario | null> {
  const s = await SecureStore.getItemAsync(K_USER); return s ? JSON.parse(s) : null;
}
export async function limparSessao() {
  await Promise.all([K_ACCESS, K_REFRESH, K_USER].map((k) => SecureStore.deleteItemAsync(k)));
}

/** Renova o access token usando o refresh guardado. */
export async function renovarToken(baseUrl: string): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(K_REFRESH);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const d = await res.json();
    await SecureStore.setItemAsync(K_ACCESS, d.accessToken);
    await SecureStore.setItemAsync(K_REFRESH, d.refreshToken);
    return true;
  } catch { return false; }
}

// ---- Login offline: hash local salgado (porta de acesso ao app sem rede) ----
async function hashSenha(salt: string, senha: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${senha}`);
}
export async function salvarCredencialOffline(cpf: string, senha: string) {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const salt = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hash = await hashSenha(salt, senha);
  await SecureStore.setItemAsync(K_OFFLINE, JSON.stringify({ cpf, salt, hash }));
}
export async function verificarCredencialOffline(cpf: string, senha: string): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(K_OFFLINE);
  if (!raw) return false;
  const { cpf: c, salt, hash } = JSON.parse(raw);
  if (c !== cpf) return false;
  return (await hashSenha(salt, senha)) === hash;
}
