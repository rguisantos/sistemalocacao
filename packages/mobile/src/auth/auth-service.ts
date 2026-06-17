import { api } from '../sync/api';
import { salvarSessao, salvarCredencialOffline, verificarCredencialOffline, obterSessao, limparSessao } from './auth-storage';
import { sincronizar } from '../sync/sync-client';

/**
 * Login com fallback offline:
 *  - online: autentica na API, guarda tokens + credencial local (hash) + sincroniza.
 *  - sem rede: valida contra o hash local salvo no último login bem-sucedido.
 */
export async function login(cpf: string, senha: string): Promise<{ online: boolean }> {
  try {
    const r = await api.postPublico('/auth/login', { cpf, senha });
    await salvarSessao({ accessToken: r.accessToken, refreshToken: r.refreshToken, usuario: { ...r.usuario, cpf } });
    await salvarCredencialOffline(cpf, senha);
    await sincronizar().catch(() => undefined); // primeiro sync (não bloqueia login)
    return { online: true };
  } catch (e) {
    // sem rede / API fora: tenta login offline
    const ok = await verificarCredencialOffline(cpf, senha);
    if (!ok) throw new Error('Sem conexão e credenciais offline inválidas.');
    const sessao = await obterSessao();
    if (!sessao) throw new Error('Faça um login online ao menos uma vez neste aparelho.');
    return { online: false };
  }
}

export async function logout() { await limparSessao(); }
