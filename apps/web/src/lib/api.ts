'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let accessToken: string | null = null;
let refreshToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

// Multi-tab: quando outra aba rotaciona o refreshToken, esta aba
// passa a usar o novo imediatamente (evita reuso do token revogado).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'refreshToken') {
      refreshToken = e.newValue;
      accessToken = null; // força refresh com o token novo na próxima chamada
    }
  });
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('refreshToken');
}

/**
 * Restaura a sessão após reload da página: troca o refreshToken
 * persistido por novos tokens e devolve o usuário (a rota /refresh
 * já retorna o UsuarioDTO completo com permissões e rotas).
 */
export async function restaurarSessao<TUsuario = unknown>(): Promise<TUsuario | null> {
  if (!refreshToken) return null;
  try {
    const resp = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!resp.ok) {
      clearTokens();
      return null;
    }
    const data = await resp.json();
    setTokens(data.accessToken, data.refreshToken);
    return data.usuario as TUsuario;
  } catch {
    return null;
  }
}

async function tentarRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  const resp = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!resp.ok) {
    clearTokens();
    return false;
  }
  const data = await resp.json();
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

/** Download autenticado (ex.: PDF gerado no servidor). Retorna Blob. */
export async function apiBlob(path: string, retry = true): Promise<Blob> {
  const resp = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (resp.status === 401 && retry && (await tentarRefresh())) {
    return apiBlob(path, false);
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error ?? `Erro ${resp.status}`);
  }
  return resp.blob();
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (resp.status === 401 && retry && (await tentarRefresh())) {
    return api<T>(path, options, false);
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error ?? `Erro ${resp.status}`);
  }
  return resp.json();
}
