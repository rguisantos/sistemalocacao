'use client';
import useSWR, { SWRConfiguration, mutate } from 'swr';
import { api } from './api';

/** Hook genérico para GET com cache SWR + refresh token automático. */
export function useApi<T = unknown>(endpoint: string | null, config?: SWRConfiguration) {
  return useSWR<T>(
    endpoint,
    (url: string) => api.get(url),
    { revalidateOnFocus: false, ...config },
  );
}

/** Hook para listas paginadas. Adiciona ?page=&limit= ao endpoint. */
export function useApiPaginated<T = unknown>(
  endpoint: string | null,
  page = 1,
  limit = 20,
  config?: SWRConfiguration,
) {
  const sep = endpoint?.includes('?') ? '&' : '?';
  const url = endpoint ? `${endpoint}${sep}pagina=${page}&limite=${limit}` : null;
  return useSWR<{ itens: T[]; total: number }>(
    url,
    (u: string) => api.get(u),
    { revalidateOnFocus: false, ...config },
  );
}

/** Hook para mutações (POST/PATCH/DELETE) com revalidação de cache. */
export function useApiMutation() {
  async function criar(endpoint: string, dados: unknown) {
    const res = await api.post(endpoint, dados);
    mutate((key: string) => typeof key === 'string' && key.startsWith(endpoint), undefined, { revalidate: true });
    return res;
  }

  async function atualizar(endpoint: string, dados: unknown) {
    const res = await api.patch(endpoint, dados);
    // Revalida tanto o item individual quanto a lista
    mutate(endpoint);
    mutate((key: string) => typeof key === 'string' && key.split('?')[0] === endpoint.split('/').slice(0, -1).join('/'));
    return res;
  }

  async function remover(endpoint: string) {
    const res = await api.del(endpoint);
    mutate((key: string) => typeof key === 'string' && key.split('?')[0] === endpoint.split('/').slice(0, -1).join('/'));
    return res;
  }

  return { criar, atualizar, remover };
}

/** Revalida todas as chaves que começam com o prefixo. */
export function revalidar(prefixo: string) {
  mutate((key: string) => typeof key === 'string' && key.startsWith(prefixo), undefined, { revalidate: true });
}
