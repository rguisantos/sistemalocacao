import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { api, setTokens, clearTokens } from './api';
import { estaOnline } from './sync';

export interface UsuarioLocal {
  id: string;
  nome: string;
  cpf: string;
  permissoes: string[];
  rotas: { id: string; nome: string }[];
}

async function hashSenha(cpf: string, senha: string): Promise<string> {
  // hash local APENAS para validar login offline; nunca sincronizado
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${cpf}:${senha}:locacoes-local-salt`
  );
}

/**
 * Login: tenta online; sem rede, valida contra credencial cacheada
 * (apenas se o usuário já logou online neste aparelho antes).
 */
export async function login(cpf: string, senha: string): Promise<UsuarioLocal> {
  if (await estaOnline()) {
    const data = await api<{
      accessToken: string;
      refreshToken: string;
      usuario: UsuarioLocal;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ cpf, senha }),
    });

    await setTokens(data.accessToken, data.refreshToken);
    // Cache para login offline futuro
    await SecureStore.setItemAsync('credencialHash', await hashSenha(cpf, senha));
    await SecureStore.setItemAsync('usuarioLocal', JSON.stringify(data.usuario));
    return data.usuario;
  }

  // OFFLINE
  const hashSalvo = await SecureStore.getItemAsync('credencialHash');
  const usuarioSalvo = await SecureStore.getItemAsync('usuarioLocal');
  if (!hashSalvo || !usuarioSalvo) {
    throw new Error('Primeiro acesso requer conexão com a internet.');
  }
  const hashAtual = await hashSenha(cpf, senha);
  if (hashAtual !== hashSalvo) {
    throw new Error('CPF ou senha inválidos.');
  }
  return JSON.parse(usuarioSalvo) as UsuarioLocal;
}

export async function logout() {
  await clearTokens();
  // mantém credencialHash/usuarioLocal para permitir login offline futuro
}

export async function usuarioSalvo(): Promise<UsuarioLocal | null> {
  const raw = await SecureStore.getItemAsync('usuarioLocal');
  return raw ? (JSON.parse(raw) as UsuarioLocal) : null;
}
