import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('locacoes.db');

/**
 * Espelho local do schema do servidor.
 * - Valores monetários como TEXT (string decimal) — nunca REAL.
 * - version = timestamp ms da última modificação (para sync).
 * - sync_status: SYNCED | PENDING_CREATE | PENDING_UPDATE | PENDING_DELETE
 */
export function inicializarBanco() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );

    -- Registros rejeitados pelo servidor no push: saem da fila de reenvio
    -- (sync_status = 'SYNC_ERROR' no registro original) e ficam aqui para
    -- revisão manual na tela "Pendências".
    CREATE TABLE IF NOT EXISTS sync_erros (
      registro_id TEXT PRIMARY KEY,
      tabela TEXT NOT NULL,
      op_original TEXT NOT NULL,    -- PENDING_CREATE | PENDING_UPDATE | PENDING_DELETE
      mensagem TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rotas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      ativo INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'SYNCED'
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      tipo TEXT DEFAULT 'PESSOA_FISICA',
      nome TEXT NOT NULL,
      razao_social TEXT,
      cpf_cnpj TEXT,
      rg_inscricao_estadual TEXT,
      telefones TEXT DEFAULT '[]',
      rota_id TEXT NOT NULL,
      observacoes TEXT,
      ativo INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 0,
      base_version INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'SYNCED'
    );

    CREATE TABLE IF NOT EXISTS enderecos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      logradouro TEXT NOT NULL,
      numero TEXT NOT NULL,
      complemento TEXT,
      bairro TEXT NOT NULL,
      cidade TEXT NOT NULL,
      estado TEXT NOT NULL,
      cep TEXT NOT NULL,
      latitude TEXT,
      longitude TEXT,
      principal INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 0,
      base_version INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'SYNCED'
    );

    CREATE TABLE IF NOT EXISTS depositos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      cidade TEXT,
      is_deleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'SYNCED'
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id TEXT PRIMARY KEY,
      plaqueta TEXT NOT NULL,
      tipo_produto_id TEXT,
      tipo_produto_nome TEXT,
      descricao TEXT,
      contador INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'SYNCED'
    );

    CREATE TABLE IF NOT EXISTS locacoes (
      id TEXT PRIMARY KEY,
      produto_id TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      endereco_id TEXT NOT NULL,
      regra TEXT NOT NULL,
      frequencia TEXT,
      valor_fixo TEXT,
      valor_partida TEXT,
      percentual TEXT,
      contador_inicial INTEGER DEFAULT 0,
      ultimo_contador INTEGER,
      ultima_cobranca_data TEXT,
      data_inicio TEXT NOT NULL,
      data_fim TEXT,
      status TEXT DEFAULT 'ATIVA',
      finalizacao_tipo TEXT,
      deposito_id TEXT,
      saldo_atual TEXT DEFAULT '0',
      is_deleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 0,
      base_version INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'SYNCED'
    );

    CREATE TABLE IF NOT EXISTS cobrancas (
      id TEXT PRIMARY KEY,
      locacao_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      data_cobranca TEXT NOT NULL,
      contador_anterior INTEGER,
      contador_atual INTEGER,
      desconto_partidas INTEGER DEFAULT 0,
      acrescimo TEXT DEFAULT '0',
      desconto_valor_receber TEXT DEFAULT '0',
      valor_liquido_final TEXT NOT NULL,
      valor_recebido_pago TEXT NOT NULL,
      saldo_resultante TEXT NOT NULL,
      forma_pagamento TEXT NOT NULL,
      status_pagamento TEXT DEFAULT 'PAGO',
      cobrador_nome TEXT,
      troca_pano INTEGER DEFAULT 0,
      observacoes TEXT,
      pix_copia_cola TEXT,
      sync_status TEXT DEFAULT 'PENDING_CREATE',
      version INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS saldos_devedores (
      id TEXT PRIMARY KEY,
      locacao_id TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      valor_original TEXT NOT NULL,
      valor_restante TEXT NOT NULL,
      status TEXT DEFAULT 'PENDENTE',
      is_deleted INTEGER DEFAULT 0,
      version INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'SYNCED'
    );

    -- Histórico de pagamentos das dívidas (somente leitura no app;
    -- pagamentos são registrados online e descem pelo pull)
    CREATE TABLE IF NOT EXISTS pagamentos_saldo (
      id TEXT PRIMARY KEY,
      saldo_id TEXT NOT NULL,
      valor TEXT NOT NULL,
      forma_pagamento TEXT NOT NULL,
      data_pagamento TEXT NOT NULL,
      observacoes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pagamentos_saldo ON pagamentos_saldo(saldo_id);
    CREATE INDEX IF NOT EXISTS idx_clientes_rota ON clientes(rota_id);
    CREATE INDEX IF NOT EXISTS idx_locacoes_cliente ON locacoes(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_cobrancas_sync ON cobrancas(sync_status);
  `);
}

/** Migrações idempotentes para bancos já criados */
export function migrarBanco() {
  for (const tabela of ['clientes', 'enderecos', 'locacoes']) {
    try {
      db.execSync(`ALTER TABLE ${tabela} ADD COLUMN base_version INTEGER DEFAULT 0`);
    } catch { /* coluna já existe */ }
  }
  for (const coluna of [
    `ALTER TABLE cobrancas ADD COLUMN status_pagamento TEXT DEFAULT 'PAGO'`,
    `ALTER TABLE cobrancas ADD COLUMN cobrador_nome TEXT`,
  ]) {
    try { db.execSync(coluna); } catch { /* coluna já existe */ }
  }
}

export function getMeta(chave: string): string | null {
  try {
    const row = db.getFirstSync<{ valor: string }>('SELECT valor FROM meta WHERE chave = ?', [chave]);
    return row?.valor ?? null;
  } catch {
    // tabela ainda não criada (leitura antes do inicializarBanco) — sem valor
    return null;
  }
}

export function setMeta(chave: string, valor: string) {
  db.runSync('INSERT OR REPLACE INTO meta (chave, valor) VALUES (?, ?)', [chave, valor]);
}
