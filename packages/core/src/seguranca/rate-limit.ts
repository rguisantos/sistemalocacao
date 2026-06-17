/**
 * Rate limiting persistente (decisão da auditoria — P0).
 *
 * Limitador em memória reseta a cada deploy/instância no serverless, deixando
 * /auth e /sync desprotegidos. A política exige um store COMPARTILHADO
 * (Redis / Vercel KV). Aqui definimos a abstração + um algoritmo de janela
 * deslizante por contador. A implementação concreta (RedisStore) injeta o store.
 */
export interface RateStore {
  /** Incrementa o contador da chave e retorna o novo valor. */
  incr(chave: string): Promise<number>;
  /** Define expiração (segundos) se ainda não houver. */
  expire(chave: string, segundos: number): Promise<void>;
}

export interface PoliticaLimite {
  janelaSegundos: number;
  maxRequisicoes: number;
}

export const LIMITES_PADRAO = {
  // login: protege contra brute force
  auth: { janelaSegundos: 60, maxRequisicoes: 10 } satisfies PoliticaLimite,
  // sync: protege contra loops/abuso de dispositivo
  sync: { janelaSegundos: 60, maxRequisicoes: 30 } satisfies PoliticaLimite,
} as const;

export interface ResultadoLimite {
  permitido: boolean;
  restante: number;
  resetEmSegundos: number;
}

/**
 * Verifica e consome uma requisição para `identificador` (ex.: IP, ou IP+CPF).
 * Janela fixa por contador com expiração — simples e suficiente para o caso.
 */
export async function verificarLimite(
  store: RateStore,
  prefixo: string,
  identificador: string,
  politica: PoliticaLimite,
): Promise<ResultadoLimite> {
  const chave = `rl:${prefixo}:${identificador}`;
  const atual = await store.incr(chave);
  if (atual === 1) {
    await store.expire(chave, politica.janelaSegundos);
  }
  const permitido = atual <= politica.maxRequisicoes;
  return {
    permitido,
    restante: Math.max(0, politica.maxRequisicoes - atual),
    resetEmSegundos: politica.janelaSegundos,
  };
}
