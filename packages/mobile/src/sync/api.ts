import { obterToken, renovarToken } from '../auth/auth-storage';
import { API_BASE_URL } from '../config';

let BASE_URL = API_BASE_URL;
export function configurarApi(url: string) { BASE_URL = url; }

async function requisitar(path: string, body: any, comToken = true, tentouRenovar = false): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (comToken) {
    const token = await obterToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });

  if (res.status === 401 && comToken && !tentouRenovar) {
    const ok = await renovarToken(BASE_URL); // tenta refresh uma vez
    if (ok) return requisitar(path, body, comToken, true);
  }
  if (!res.ok) {
    const corpo = await res.json().catch(() => ({} as any));
    const msg = Array.isArray(corpo.message) ? corpo.message.join('; ') : corpo.message;
    throw new Error(msg ? `API ${path}: ${msg}` : `API ${path} => ${res.status}`);
  }
  return res.json();
}

export const api = {
  post: (path: string, body: any) => requisitar(path, body, true),
  postPublico: (path: string, body: any) => requisitar(path, body, false),
};
