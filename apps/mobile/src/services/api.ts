import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

let accessToken: string | null = null;

export async function setTokens(access: string, refresh: string) {
  accessToken = access;
  await SecureStore.setItemAsync('refreshToken', refresh);
}

export async function clearTokens() {
  accessToken = null;
  await SecureStore.deleteItemAsync('refreshToken');
}

async function tentarRefresh(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) return false;
  try {
    const resp = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    await setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
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
      ...(options.headers ?? {}),
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
