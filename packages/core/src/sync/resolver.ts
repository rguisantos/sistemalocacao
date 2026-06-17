import { Entidade, RegistroSync } from './contrato';

/**
 * Resolução de conflitos no servidor (decisão da auditoria — P0/P1).
 *
 * Substitui o "mobile sempre vence" por uma estratégia segura por tipo de dado:
 *
 *  - APPEND_ONLY (cobranca, pagamento): nunca sobrescreve. Se o id já existe,
 *    é o MESMO registro reenviado (idempotência) -> ignora. Conflito de saldo
 *    deixa de existir porque o saldo é derivado, não sincronizado.
 *
 *  - VERSIONADO (cliente, locacao, produto...): concorrência otimista por
 *    `version`. Se a versão do cliente bate com a do servidor, aplica e
 *    incrementa. Se diverge, registra ConflitoSincronizacao e o servidor
 *    prevalece (o cliente recebe a versão correta no próximo pull).
 */
export type Estrategia = 'APPEND_ONLY' | 'VERSIONADO';

export const ESTRATEGIA_POR_ENTIDADE: Record<Entidade, Estrategia> = {
  cobranca: 'APPEND_ONLY',
  pagamento: 'APPEND_ONLY',
  rota: 'VERSIONADO',
  cliente: 'VERSIONADO',
  endereco: 'VERSIONADO',
  produto: 'VERSIONADO',
  tipoProduto: 'VERSIONADO',
  tamanho: 'VERSIONADO',
  condicao: 'VERSIONADO',
  deposito: 'VERSIONADO',
  locacao: 'VERSIONADO',
  saldoDevedorLocacao: 'VERSIONADO',
  manutencao: 'VERSIONADO',
  usuario: 'VERSIONADO',
};

export type Decisao =
  | { acao: 'INSERIR'; registro: RegistroSync }
  | { acao: 'ATUALIZAR'; registro: RegistroSync; novaVersao: number }
  | { acao: 'IGNORAR_DUPLICADO' }
  | { acao: 'CONFLITO'; versaoServidor: number; versaoCliente: number };

export interface EstadoServidor {
  existe: boolean;
  version?: number;
}

/**
 * Decide o que fazer com um registro recebido no push.
 * `atual` é o estado do registro no servidor (ou existe=false se novo).
 */
export function resolver(
  entidade: Entidade,
  recebido: RegistroSync,
  atual: EstadoServidor,
): Decisao {
  const estrategia = ESTRATEGIA_POR_ENTIDADE[entidade];

  if (estrategia === 'APPEND_ONLY') {
    // Idempotência: se já existe, é reenvio do mesmo registro imutável.
    return atual.existe ? { acao: 'IGNORAR_DUPLICADO' } : { acao: 'INSERIR', registro: recebido };
  }

  // VERSIONADO
  if (!atual.existe) return { acao: 'INSERIR', registro: recebido };

  const vServidor = atual.version ?? 0;
  const vCliente = recebido.version ?? 0;

  if (vCliente === vServidor) {
    return { acao: 'ATUALIZAR', registro: recebido, novaVersao: vServidor + 1 };
  }
  // Cliente trabalhou sobre uma versão desatualizada -> conflito, servidor prevalece.
  return { acao: 'CONFLITO', versaoServidor: vServidor, versaoCliente: vCliente };
}
