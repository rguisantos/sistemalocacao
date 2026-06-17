'use client';
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function token() { return typeof window !== 'undefined' ? localStorage.getItem('token') : null; }

/** Tenta renovar o access token usando o refresh token guardado. */
async function tentarRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const r = localStorage.getItem('refresh');
  if (!r) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: r }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data?.accessToken) return false;
    localStorage.setItem('token', data.accessToken);
    if (data.refreshToken) localStorage.setItem('refresh', data.refreshToken);
    return true;
  } catch { return false; }
}

function sairParaLogin() {
  if (typeof window === 'undefined') return;
  ['token', 'refresh', 'usuario'].forEach((k) => localStorage.removeItem(k));
  window.location.href = '/login';
}

async function req(metodo: string, path: string, body?: unknown, jaRenovou = false) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = token(); if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, { method: metodo, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && typeof window !== 'undefined') {
    // tenta refresh uma vez antes de desistir (token de acesso é curto, ~15 min)
    if (!jaRenovou && (await tentarRefresh())) return req(metodo, path, body, true);
    sairParaLogin();
    throw new Error('Sessão expirada.');
  }
  if (!res.ok) {
    const erro = await res.json().catch(() => ({}));
    // NestJS retorna `message` como string OU array (erros de validação).
    const msg = Array.isArray(erro.message) ? erro.message.join('; ') : erro.message;
    throw new Error(msg ?? `Erro ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (p: string) => req('GET', p),
  post: (p: string, b?: unknown) => req('POST', p, b),
  patch: (p: string, b?: unknown) => req('PATCH', p, b),
  del: (p: string) => req('DELETE', p),
  /** Baixa um arquivo (PDF/Excel) com o token e dispara o download no navegador. */
  async baixar(path: string, nomeArquivo: string, jaRenovou = false): Promise<void> {
    const t = token();
    const res = await fetch(`${BASE}${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
    if (res.status === 401 && typeof window !== 'undefined') {
      if (!jaRenovou && (await tentarRefresh())) return this.baixar(path, nomeArquivo, true);
      sairParaLogin();
      throw new Error('Sessão expirada.');
    }
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivo; a.click();
    URL.revokeObjectURL(url);
  },
  login: (cpf: string, senha: string) =>
    fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpf, senha }) })
      .then(async (r) => { if (!r.ok) throw new Error('CPF ou senha inválidos.'); return r.json(); }),
};
