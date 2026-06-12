// Configurações dinâmicas do sistema (chave-valor no banco).
// Usado para credenciais Mercado Pago configuráveis pelo painel
// (spec §10), com fallback para as variáveis de ambiente.
import { prisma } from '@locacoes/database';

const CHAVES_INTEGRACAO = [
  'mercadopago_access_token',
  'mercadopago_webhook_secret',
  'mercadopago_payer_email',
] as const;
export type ChaveIntegracao = (typeof CHAVES_INTEGRACAO)[number];

// Cache simples: evita um SELECT por cobrança PIX/webhook.
let cache: Record<string, string> | null = null;
let cacheExpira = 0;
const TTL_MS = 60_000;

export async function obterConfiguracoes(): Promise<Record<string, string>> {
  if (cache && Date.now() < cacheExpira) return cache;
  const linhas = await prisma.configuracaoSistema.findMany();
  cache = Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
  cacheExpira = Date.now() + TTL_MS;
  return cache;
}

export function invalidarCacheConfiguracoes() {
  cache = null;
}

/** Valor do banco; se ausente/vazio, cai para o env. */
export async function obterConfig(chave: ChaveIntegracao, fallbackEnv?: string): Promise<string | undefined> {
  const cfg = await obterConfiguracoes();
  const valor = cfg[chave];
  return valor && valor.trim() !== '' ? valor : fallbackEnv;
}

export async function salvarConfiguracoes(valores: Partial<Record<ChaveIntegracao, string>>) {
  for (const [chave, valor] of Object.entries(valores)) {
    if (!CHAVES_INTEGRACAO.includes(chave as ChaveIntegracao)) continue;
    if (valor === undefined) continue;
    await prisma.configuracaoSistema.upsert({
      where: { chave },
      update: { valor },
      create: { chave, valor },
    });
  }
  invalidarCacheConfiguracoes();
}

/** Mascara segredos para exibição: mantém só os 4 últimos caracteres. */
export function mascarar(valor: string | undefined): string {
  if (!valor) return '';
  if (valor.length <= 4) return '••••';
  return `••••${valor.slice(-4)}`;
}
