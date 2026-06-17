/**
 * Contrato de sincronização offline-first (decisões da auditoria — P0/P1).
 *
 * Princípios:
 *  1. ALLOWLIST POR ENTIDADE — só os campos listados trafegam. `senha`, tokens
 *     e qualquer segredo NUNCA entram. Isso impede o bug clássico de a senha
 *     ser apagada/sobrescrita pelo sync.
 *  2. TOMBSTONES — exclusões viajam como registros com `deletedAt`, nunca
 *     omitidos. Assim o cliente remove localmente o que foi apagado no servidor.
 *  3. APPEND-ONLY para dinheiro — Pagamento e Cobranca não são editados; o
 *     saldo é derivado no servidor. Conflito de saldo deixa de existir.
 *  4. IDEMPOTÊNCIA — todo registro tem UUID gerado no cliente; o push é upsert
 *     por UUID. Reenvio nunca duplica.
 *  5. RELÓGIO DO SERVIDOR — o corte do pull usa o timestamp do servidor,
 *     devolvido a cada ciclo, evitando clock skew do dispositivo.
 */

export type Entidade =
  | 'rota' | 'cliente' | 'endereco' | 'produto' | 'tipoProduto' | 'tamanho'
  | 'condicao' | 'deposito' | 'locacao' | 'cobranca' | 'pagamento'
  | 'saldoDevedorLocacao' | 'manutencao' | 'usuario';

/**
 * Campos permitidos por entidade no PUSH (cliente -> servidor).
 * Tudo fora desta lista é ignorado pelo servidor.
 */
export const ALLOWLIST_PUSH: Record<Entidade, readonly string[]> = {
  // Cadastros normalmente vêm só no pull; push restrito ao essencial editável em campo.
  rota: ['id', 'nome', 'updatedAt', 'deletedAt', 'version'],
  cliente: ['id', 'tipo', 'nome', 'cpfCnpj', 'rgIe', 'telefones', 'observacoes', 'rotaId', 'updatedAt', 'deletedAt', 'version'],
  endereco: ['id', 'clienteId', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep', 'latitude', 'longitude', 'updatedAt', 'deletedAt', 'version'],
  produto: ['id', 'plaqueta', 'tipoId', 'descricao', 'tamanhoId', 'condicaoId', 'chave', 'contador', 'updatedAt', 'deletedAt', 'version'],
  tipoProduto: ['id', 'nome', 'updatedAt', 'deletedAt'],
  tamanho: ['id', 'descricao', 'updatedAt', 'deletedAt'],
  condicao: ['id', 'descricao', 'updatedAt', 'deletedAt'],
  deposito: ['id', 'nome', 'endereco', 'updatedAt', 'deletedAt'],
  locacao: ['id', 'produtoId', 'clienteId', 'enderecoId', 'regra', 'frequencia', 'valorFixo', 'valorPartida', 'percentual', 'contadorInicial', 'dataInicio', 'dataFim', 'status', 'finalizacaoTipo', 'depositoId', 'relocadaParaId', 'regraVersao', 'updatedAt', 'deletedAt', 'version'],
  // [AUDIT] Cobranca/Pagamento: append-only. saldoDevedorAtual NÃO está aqui — é derivado.
  cobranca: ['id', 'locacaoId', 'usuarioId', 'dataCobranca', 'regraSnapshot', 'regraVersaoSnapshot', 'contadorAnterior', 'contadorAtual', 'contadorReiniciado', 'partidasJogadas', 'descontoPartidas', 'partidasConsideradas', 'acrescimo', 'valorBruto', 'valorPercentual', 'descontoValorReceber', 'valorLiquidoBase', 'saldoDevedorAnterior', 'valorLiquidoFinal', 'trocaPano', 'statusPagamento', 'pixId', 'updatedAt', 'deletedAt'],
  pagamento: ['id', 'alvo', 'cobrancaId', 'saldoId', 'usuarioId', 'valor', 'formaPagamento', 'pixId', 'dataPagamento', 'estornadoPorId', 'updatedAt', 'deletedAt'],
  saldoDevedorLocacao: ['id', 'locacaoId', 'clienteId', 'produtoDescricao', 'valorOriginal', 'updatedAt', 'deletedAt', 'version'],
  manutencao: ['id', 'produtoId', 'cobrancaId', 'usuarioId', 'tipo', 'descricao', 'data', 'updatedAt', 'deletedAt', 'version'],
  // [AUDIT P0] Usuario: NUNCA aceita `senha`/`tokenVersao` no push. Só o próprio pushToken.
  usuario: ['id', 'pushToken', 'updatedAt'],
};

/** Campos que NUNCA podem trafegar em nenhuma direção, em hipótese alguma. */
export const CAMPOS_PROIBIDOS = new Set(['senha', 'tokenVersao']);

/** Remove campos fora da allowlist (e os proibidos) de um registro recebido no push. */
export function sanitizarPush<T extends Record<string, unknown>>(entidade: Entidade, registro: T): Partial<T> {
  const permitidos = new Set(ALLOWLIST_PUSH[entidade]);
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(registro)) {
    if (CAMPOS_PROIBIDOS.has(k)) continue;
    if (permitidos.has(k)) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ---- DTOs do protocolo ----
export interface RegistroSync {
  id: string;
  updatedAt: string;       // ISO
  deletedAt?: string | null;
  version?: number;
  [campo: string]: unknown;
}

export interface PullRequest {
  lastPulledAt: string | null;   // null no primeiro sync
  fullSync?: boolean;
}

export interface PullResponse {
  serverTimestamp: string;                              // [AUDIT] relógio do servidor
  mudancas: Partial<Record<Entidade, RegistroSync[]>>;  // inclui tombstones (deletedAt != null)
}

export interface PushRequest {
  mudancas: Partial<Record<Entidade, RegistroSync[]>>;
  idempotencyKey: string;        // por lote; o servidor descarta lote repetido
}

export interface PushResponse {
  serverTimestamp: string;
  conflitos: { entidade: Entidade; id: string }[];
}
