/**
 * Schema SQLite local (offline-first), espelhando as entidades sincronizáveis.
 * Cada tabela tem metadados de sync:
 *   _syncStatus: 'synced' | 'created' | 'updated'
 *   _lastModified: epoch ms da última alteração local
 * Valores monetários ficam como TEXT para preservar precisão decimal.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sync_meta ( chave TEXT PRIMARY KEY, valor TEXT );

CREATE TABLE IF NOT EXISTS usuario (
  id TEXT PRIMARY KEY, nome TEXT, cpf TEXT, pushToken TEXT,
  updatedAt TEXT, deletedAt TEXT,
  _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rota (
  id TEXT PRIMARY KEY, nome TEXT, version INTEGER DEFAULT 0,
  updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cliente (
  id TEXT PRIMARY KEY, tipo TEXT, nome TEXT, cpfCnpj TEXT, rgIe TEXT,
  telefones TEXT, observacoes TEXT, rotaId TEXT, version INTEGER DEFAULT 0,
  updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS endereco (
  id TEXT PRIMARY KEY, clienteId TEXT, logradouro TEXT, numero TEXT, complemento TEXT,
  bairro TEXT, cidade TEXT, estado TEXT, cep TEXT, latitude REAL, longitude REAL, version INTEGER DEFAULT 0,
  updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS produto (
  id TEXT PRIMARY KEY, plaqueta TEXT, tipoId TEXT, descricao TEXT, tamanhoId TEXT, condicaoId TEXT,
  chave TEXT, contador INTEGER DEFAULT 0, version INTEGER DEFAULT 0,
  updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tipo_produto ( id TEXT PRIMARY KEY, nome TEXT, updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0 );
CREATE TABLE IF NOT EXISTS tamanho ( id TEXT PRIMARY KEY, descricao TEXT, updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0 );
CREATE TABLE IF NOT EXISTS condicao ( id TEXT PRIMARY KEY, descricao TEXT, updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0 );
CREATE TABLE IF NOT EXISTS deposito ( id TEXT PRIMARY KEY, nome TEXT, endereco TEXT, updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0 );
CREATE TABLE IF NOT EXISTS locacao (
  id TEXT PRIMARY KEY, produtoId TEXT, clienteId TEXT, enderecoId TEXT, regra TEXT, frequencia TEXT,
  valorFixo TEXT, valorPartida TEXT, percentual TEXT, contadorInicial INTEGER, regraVersao INTEGER DEFAULT 1,
  dataInicio TEXT, dataFim TEXT, status TEXT, finalizacaoTipo TEXT, depositoId TEXT,
  saldoDevedorAtual TEXT DEFAULT '0', version INTEGER DEFAULT 0,
  updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cobranca (
  id TEXT PRIMARY KEY, locacaoId TEXT, usuarioId TEXT, dataCobranca TEXT,
  regraSnapshot TEXT, regraVersaoSnapshot INTEGER, contadorAnterior INTEGER, contadorAtual INTEGER, contadorReiniciado INTEGER DEFAULT 0,
  partidasJogadas INTEGER, descontoPartidas INTEGER DEFAULT 0, partidasConsideradas INTEGER,
  acrescimo TEXT DEFAULT '0', valorBruto TEXT, valorPercentual TEXT, descontoValorReceber TEXT DEFAULT '0',
  valorLiquidoBase TEXT, saldoDevedorAnterior TEXT, valorLiquidoFinal TEXT,
  trocaPano INTEGER DEFAULT 0, statusPagamento TEXT, pixId TEXT,
  updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pagamento (
  id TEXT PRIMARY KEY, alvo TEXT, cobrancaId TEXT, saldoId TEXT, usuarioId TEXT,
  valor TEXT, formaPagamento TEXT, pixId TEXT, dataPagamento TEXT,
  updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS saldo_devedor_locacao (
  id TEXT PRIMARY KEY, locacaoId TEXT, clienteId TEXT, produtoDescricao TEXT,
  valorOriginal TEXT, valorRestante TEXT, status TEXT, dataQuitacao TEXT, version INTEGER DEFAULT 0,
  updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS manutencao (
  id TEXT PRIMARY KEY, produtoId TEXT, cobrancaId TEXT, usuarioId TEXT, tipo TEXT, descricao TEXT, data TEXT, version INTEGER DEFAULT 0,
  updatedAt TEXT, deletedAt TEXT, _syncStatus TEXT DEFAULT 'synced', _lastModified INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cliente_rota ON cliente(rotaId);
CREATE INDEX IF NOT EXISTS idx_locacao_cliente ON locacao(clienteId, status);
CREATE INDEX IF NOT EXISTS idx_locacao_produto ON locacao(produtoId, status);
CREATE INDEX IF NOT EXISTS idx_cobranca_locacao ON cobranca(locacaoId, dataCobranca);
CREATE INDEX IF NOT EXISTS idx_dirty_cobranca ON cobranca(_syncStatus);
CREATE INDEX IF NOT EXISTS idx_saldo_cliente ON saldo_devedor_locacao(clienteId, status);
CREATE INDEX IF NOT EXISTS idx_pagamento_saldo ON pagamento(saldoId);
CREATE INDEX IF NOT EXISTS idx_pagamento_cobranca ON pagamento(cobrancaId);
CREATE INDEX IF NOT EXISTS idx_manutencao_produto ON manutencao(produtoId);
`;
