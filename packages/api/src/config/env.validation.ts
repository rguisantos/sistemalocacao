/**
 * Validação de variáveis de ambiente no boot (decisão da auditoria — P0).
 * Sem JWT_SECRET forte ou DATABASE_URL a aplicação NÃO sobe — nunca cai em default.
 */
export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  REDIS_URL: string;
  FUSO_OPERACAO: string;
  PORT: number;
}

export function validarEnv(): Env {
  const { DATABASE_URL, JWT_SECRET, REDIS_URL } = process.env;
  const faltando: string[] = [];
  if (!DATABASE_URL) faltando.push('DATABASE_URL');
  if (!REDIS_URL) faltando.push('REDIS_URL');
  if (!JWT_SECRET || JWT_SECRET.length < 32) faltando.push('JWT_SECRET (>= 32 chars)');
  if (faltando.length) {
    throw new Error(`Variáveis de ambiente ausentes/inválidas: ${faltando.join(', ')}`);
  }
  return {
    DATABASE_URL: DATABASE_URL!,
    JWT_SECRET: JWT_SECRET!,
    JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '15m',
    JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '30d',
    REDIS_URL: REDIS_URL!,
    FUSO_OPERACAO: process.env.FUSO_OPERACAO ?? 'America/Sao_Paulo',
    PORT: Number(process.env.PORT ?? 3000),
  };
}
