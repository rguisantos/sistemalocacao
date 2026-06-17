import { todos, um, executar, emTransacao, obterMeta, definirMeta } from '../db/database';
import { v4 as uuid } from 'uuid';
import { somar } from '@app/core';

/** Rotas disponíveis localmente (vindas do sync). */
export const listarRotas = () => todos(`SELECT * FROM rota WHERE deletedAt IS NULL ORDER BY nome`);

/** Clientes da rota, com flag de saldo devedor (locação ativa com saldo ou saldo finalizado pendente). */
export function clientesDaRota(rotaId: string) {
  return todos(`
    SELECT c.*,
      ( (SELECT COUNT(*) FROM locacao l WHERE l.clienteId = c.id AND l.status='ATIVA' AND CAST(l.saldoDevedorAtual AS REAL) > 0)
      + (SELECT COUNT(*) FROM saldo_devedor_locacao s WHERE s.clienteId = c.id AND s.status='PENDENTE' AND CAST(s.valorRestante AS REAL) > 0)
      ) AS temSaldo
    FROM cliente c
    WHERE c.rotaId = ? AND c.deletedAt IS NULL
    ORDER BY c.nome`, [rotaId]);
}

/** Abas do cliente: locações ativas + saldos devedores pendentes (locações finalizadas). */
export async function abasDoCliente(clienteId: string) {
  const locacoes = await todos(`
    SELECT l.*, p.plaqueta, p.descricao AS produtoDescricao, p.contador AS contadorProduto
    FROM locacao l JOIN produto p ON p.id = l.produtoId
    WHERE l.clienteId = ? AND l.status='ATIVA' AND l.deletedAt IS NULL`, [clienteId]);
  const saldos = await todos(`
    SELECT * FROM saldo_devedor_locacao
    WHERE clienteId = ? AND status='PENDENTE' AND CAST(valorRestante AS REAL) > 0 AND deletedAt IS NULL`, [clienteId]);
  return { locacoes, saldos };
}

/** Última cobrança de uma locação (para definir referência e contador anterior). */
export const ultimaCobranca = (locacaoId: string) =>
  um(`SELECT * FROM cobranca WHERE locacaoId = ? AND deletedAt IS NULL ORDER BY dataCobranca DESC LIMIT 1`, [locacaoId]);


export function listarManutencoes(filtro?: { produtoId?: string; tipo?: string }) {
  const cond: string[] = ['m.deletedAt IS NULL']; const params: any[] = [];
  if (filtro?.produtoId) { cond.push('m.produtoId = ?'); params.push(filtro.produtoId); }
  if (filtro?.tipo) { cond.push('m.tipo = ?'); params.push(filtro.tipo); }
  return todos(`SELECT m.*, p.plaqueta FROM manutencao m JOIN produto p ON p.id = m.produtoId
    WHERE ${cond.join(' AND ')} ORDER BY m.data DESC`, params);
}

/** Manutenção avulsa (sem cobrança vinculada) — grava como 'created' para sincronizar. */
export async function registrarManutencaoAvulsa(usuarioId: string, produtoId: string, tipo: string, descricao?: string) {
  const agora = new Date().toISOString();
  await executar(
    `INSERT INTO manutencao (id, produtoId, usuarioId, tipo, descricao, data, updatedAt, _syncStatus, _lastModified)
     VALUES (?,?,?,?,?,?,?,'created',?)`,
    [uuid(), produtoId, usuarioId, tipo, descricao ?? null, agora, agora, Date.now()],
  );
}

// ---------------------------------------------------------------------------
// CRIAÇÃO EM CAMPO (offline-first) — grava local como 'created' p/ subir no push.
// O servidor deriva o saldo; aqui nunca confiamos valores derivados.
// ---------------------------------------------------------------------------
const agoraIso = () => new Date().toISOString();

/** Listas auxiliares (vindas do sync) para os formulários. */
export const listarTipos = () => todos(`SELECT * FROM tipo_produto WHERE deletedAt IS NULL ORDER BY nome`);
export const listarTamanhos = () => todos(`SELECT * FROM tamanho WHERE deletedAt IS NULL ORDER BY descricao`);
export const listarCondicoes = () => todos(`SELECT * FROM condicao WHERE deletedAt IS NULL ORDER BY descricao`);
export const enderecosDoCliente = (clienteId: string) =>
  todos(`SELECT * FROM endereco WHERE clienteId = ? AND deletedAt IS NULL ORDER BY logradouro`, [clienteId]);
/** Produtos sem locação ativa (disponíveis para locar). */
export const produtosDisponiveis = () =>
  todos(`SELECT p.* FROM produto p
         WHERE p.deletedAt IS NULL
           AND p.id NOT IN (SELECT produtoId FROM locacao WHERE status='ATIVA' AND deletedAt IS NULL)
         ORDER BY p.plaqueta`);

export interface NovoEndereco { logradouro: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string; cep?: string; latitude?: number; longitude?: number; }

/** Cria cliente + (opcional) endereço numa transação local. */
export async function criarClienteComEndereco(d: {
  tipo: 'PF' | 'PJ'; nome: string; cpfCnpj: string; rgIe?: string; telefones?: string[]; observacoes?: string; rotaId: string; endereco?: NovoEndereco;
}): Promise<{ clienteId: string; enderecoId?: string }> {
  const clienteId = uuid(); const agora = agoraIso(); const lm = Date.now();
  let enderecoId: string | undefined;
  await emTransacao(async (db) => {
    await db.runAsync(
      `INSERT INTO cliente (id, tipo, nome, cpfCnpj, rgIe, telefones, observacoes, rotaId, version, updatedAt, _syncStatus, _lastModified)
       VALUES (?,?,?,?,?,?,?,?,0,?, 'created', ?)`,
      [clienteId, d.tipo, d.nome, d.cpfCnpj, d.rgIe ?? null, JSON.stringify(d.telefones ?? []), d.observacoes ?? null, d.rotaId, agora, lm],
    );
    if (d.endereco?.logradouro) {
      enderecoId = uuid(); const e = d.endereco;
      await db.runAsync(
        `INSERT INTO endereco (id, clienteId, logradouro, numero, complemento, bairro, cidade, estado, cep, latitude, longitude, version, updatedAt, _syncStatus, _lastModified)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?, 'created', ?)`,
        [enderecoId, clienteId, e.logradouro, e.numero ?? null, e.complemento ?? null, e.bairro ?? null, e.cidade ?? null, e.estado ?? null, e.cep ?? null, e.latitude ?? null, e.longitude ?? null, agora, lm],
      );
    }
  });
  return { clienteId, enderecoId };
}

/** Adiciona um endereço a um cliente existente. */
export async function adicionarEndereco(clienteId: string, e: NovoEndereco): Promise<string> {
  const id = uuid(); const agora = agoraIso();
  await executar(
    `INSERT INTO endereco (id, clienteId, logradouro, numero, complemento, bairro, cidade, estado, cep, latitude, longitude, version, updatedAt, _syncStatus, _lastModified)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?, 'created', ?)`,
    [id, clienteId, e.logradouro, e.numero ?? null, e.complemento ?? null, e.bairro ?? null, e.cidade ?? null, e.estado ?? null, e.cep ?? null, e.latitude ?? null, e.longitude ?? null, agora, Date.now()],
  );
  return id;
}

/** Cria produto. */
export async function criarProduto(d: { plaqueta: string; tipoId: string; descricao?: string; tamanhoId: string; condicaoId: string; chave?: string; contador?: number; }): Promise<string> {
  const id = uuid(); const agora = agoraIso();
  await executar(
    `INSERT INTO produto (id, plaqueta, tipoId, descricao, tamanhoId, condicaoId, chave, contador, version, updatedAt, _syncStatus, _lastModified)
     VALUES (?,?,?,?,?,?,?,?,0,?, 'created', ?)`,
    [id, d.plaqueta, d.tipoId, d.descricao ?? null, d.tamanhoId, d.condicaoId, d.chave ?? null, d.contador ?? 0, agora, Date.now()],
  );
  return id;
}

/**
 * Cria locação ativa. A trava de "um produto ativo por vez" é garantida pelo
 * servidor no push (índice único); aqui evitamos o erro óbvio checando local.
 */
export async function criarLocacao(d: {
  produtoId: string; clienteId: string; enderecoId: string; regra: string;
  frequencia?: string; valorFixo?: string; valorPartida?: string; percentual?: string; contadorInicial?: number;
}): Promise<string> {
  const jaAtiva = await um(`SELECT id FROM locacao WHERE produtoId = ? AND status='ATIVA' AND deletedAt IS NULL`, [d.produtoId]);
  if (jaAtiva) throw new Error('Este produto já tem uma locação ativa.');
  const id = uuid(); const agora = agoraIso();
  await executar(
    `INSERT INTO locacao (id, produtoId, clienteId, enderecoId, regra, frequencia, valorFixo, valorPartida, percentual, contadorInicial, regraVersao, dataInicio, status, saldoDevedorAtual, version, updatedAt, _syncStatus, _lastModified)
     VALUES (?,?,?,?,?,?,?,?,?,?,1,?, 'ATIVA', '0', 0, ?, 'created', ?)`,
    [id, d.produtoId, d.clienteId, d.enderecoId, d.regra, d.frequencia ?? null, d.valorFixo ?? null, d.valorPartida ?? null, d.percentual ?? null, d.contadorInicial ?? null, agora, agora, Date.now()],
  );
  return id;
}

// ---------------------------------------------------------------------------
// EDIÇÃO EM CAMPO (offline-first)
// Regra de sync: registro 'created' (ainda não enviado) continua 'created' com
// os novos dados; registro 'synced' vira 'updated'. version NÃO é mexida aqui
// (mandamos a última versão conhecida; o servidor resolve conflito e devolve no pull).
// ---------------------------------------------------------------------------
const MARCA_EDICAO = "_syncStatus = CASE WHEN _syncStatus = 'created' THEN 'created' ELSE 'updated' END";

export const obterCliente = (id: string) => um(`SELECT * FROM cliente WHERE id = ?`, [id]);
export const obterProduto = (id: string) => um(`SELECT * FROM produto WHERE id = ?`, [id]);
export const obterLocacao = (id: string) => um(`SELECT * FROM locacao WHERE id = ?`, [id]);
export const obterEndereco = (id: string) => um(`SELECT * FROM endereco WHERE id = ?`, [id]);

export async function atualizarCliente(id: string, d: {
  tipo: 'PF' | 'PJ'; nome: string; rgIe?: string; telefones?: string[]; observacoes?: string; rotaId: string;
}): Promise<void> {
  await executar(
    `UPDATE cliente SET tipo=?, nome=?, rgIe=?, telefones=?, observacoes=?, rotaId=?, updatedAt=?, ${MARCA_EDICAO}, _lastModified=? WHERE id=?`,
    [d.tipo, d.nome, d.rgIe ?? null, JSON.stringify(d.telefones ?? []), d.observacoes ?? null, d.rotaId, new Date().toISOString(), Date.now(), id],
  );
}

export async function atualizarProduto(id: string, d: {
  plaqueta: string; tipoId: string; descricao?: string; tamanhoId: string; condicaoId: string; chave?: string; contador?: number;
}): Promise<void> {
  await executar(
    `UPDATE produto SET plaqueta=?, tipoId=?, descricao=?, tamanhoId=?, condicaoId=?, chave=?, contador=?, updatedAt=?, ${MARCA_EDICAO}, _lastModified=? WHERE id=?`,
    [d.plaqueta, d.tipoId, d.descricao ?? null, d.tamanhoId, d.condicaoId, d.chave ?? null, d.contador ?? 0, new Date().toISOString(), Date.now(), id],
  );
}

export async function atualizarLocacao(id: string, d: {
  regra: string; frequencia?: string; valorFixo?: string; valorPartida?: string; percentual?: string; enderecoId: string;
}): Promise<void> {
  // mudou a regra/valores → nova versão da regra (cobranças passam a fotografar esta).
  await executar(
    `UPDATE locacao SET regra=?, frequencia=?, valorFixo=?, valorPartida=?, percentual=?, enderecoId=?,
       regraVersao = regraVersao + 1, updatedAt=?, ${MARCA_EDICAO}, _lastModified=? WHERE id=?`,
    [d.regra, d.frequencia ?? null, d.valorFixo ?? null, d.valorPartida ?? null, d.percentual ?? null, d.enderecoId, new Date().toISOString(), Date.now(), id],
  );
}

export async function atualizarEndereco(id: string, e: NovoEndereco): Promise<void> {
  await executar(
    `UPDATE endereco SET logradouro=?, numero=?, complemento=?, bairro=?, cidade=?, estado=?, cep=?, latitude=?, longitude=?, updatedAt=?, ${MARCA_EDICAO}, _lastModified=? WHERE id=?`,
    [e.logradouro, e.numero ?? null, e.complemento ?? null, e.bairro ?? null, e.cidade ?? null, e.estado ?? null, e.cep ?? null, e.latitude ?? null, e.longitude ?? null, new Date().toISOString(), Date.now(), id],
  );
}

/** Remove endereço: se nunca foi sincronizado, apaga local; senão grava tombstone (deletedAt). */
export async function removerEndereco(id: string): Promise<void> {
  const row = await um<{ _syncStatus: string }>(`SELECT _syncStatus FROM endereco WHERE id = ?`, [id]);
  if (row?._syncStatus === 'created') {
    await executar(`DELETE FROM endereco WHERE id = ?`, [id]);
  } else {
    await executar(
      `UPDATE endereco SET deletedAt=?, updatedAt=?, ${MARCA_EDICAO}, _lastModified=? WHERE id=?`,
      [new Date().toISOString(), new Date().toISOString(), Date.now(), id],
    );
  }
}

/** Todos os produtos (para a tela de listagem/edição). */
export const listarProdutos = () => todos(`SELECT * FROM produto WHERE deletedAt IS NULL ORDER BY plaqueta`);

/** Resumo para o dashboard (contagens sobre o banco local, já escopado pelo sync). */
export async function resumoDashboard() {
  const n = async (sql: string, p: any[] = []) => Number((await um<{ n: number }>(sql, p))?.n ?? 0);
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    clientes: await n(`SELECT COUNT(*) n FROM cliente WHERE deletedAt IS NULL`),
    produtos: await n(`SELECT COUNT(*) n FROM produto WHERE deletedAt IS NULL`),
    locacoesAtivas: await n(`SELECT COUNT(*) n FROM locacao WHERE status='ATIVA' AND deletedAt IS NULL`),
    clientesComSaldo: await n(`SELECT COUNT(DISTINCT clienteId) n FROM (
        SELECT clienteId FROM locacao WHERE status='ATIVA' AND CAST(saldoDevedorAtual AS REAL)>0 AND deletedAt IS NULL
        UNION SELECT clienteId FROM saldo_devedor_locacao WHERE status='PENDENTE' AND CAST(valorRestante AS REAL)>0 AND deletedAt IS NULL)`),
    cobrancasHoje: await n(`SELECT COUNT(*) n FROM cobranca WHERE substr(dataCobranca,1,10)=? AND deletedAt IS NULL`, [hoje]),
    pendentesSync: await n(`SELECT COUNT(*) n FROM (
        SELECT id FROM cliente WHERE _syncStatus!='synced'
        UNION ALL SELECT id FROM endereco WHERE _syncStatus!='synced'
        UNION ALL SELECT id FROM produto WHERE _syncStatus!='synced'
        UNION ALL SELECT id FROM locacao WHERE _syncStatus!='synced'
        UNION ALL SELECT id FROM cobranca WHERE _syncStatus!='synced'
        UNION ALL SELECT id FROM pagamento WHERE _syncStatus!='synced'
        UNION ALL SELECT id FROM manutencao WHERE _syncStatus!='synced')`),
  };
}

// ---------------------------------------------------------------------------
// QUITAÇÃO DE SALDO, HISTÓRICO E RELATÓRIO (telas portadas do app de referência)
// ---------------------------------------------------------------------------

/**
 * Registra pagamento contra um saldo devedor (append-only, 'created').
 * valorRestante/status são DERIVADOS pelo servidor — aqui atualizamos o valor
 * local apenas para feedback imediato, sem marcar o saldo como "dirty" (o pull
 * reconcilia). O FK é `saldoId` (igual ao servidor e ao allowlist).
 */
export async function pagarSaldoDevedor(usuarioId: string, saldoId: string, valor: number, formaPagamento: string): Promise<{ restante: string }> {
  const agora = new Date().toISOString();
  await executar(
    `INSERT INTO pagamento (id, alvo, saldoId, usuarioId, valor, formaPagamento, dataPagamento, updatedAt, _syncStatus, _lastModified)
     VALUES (?, 'SALDO_DEVEDOR_LOCACAO', ?,?,?,?,?,?, 'created', ?)`,
    [uuid(), saldoId, usuarioId, valor.toFixed(2), formaPagamento, agora, agora, Date.now()],
  );
  const saldo = await um<{ valorOriginal: string }>(`SELECT valorOriginal FROM saldo_devedor_locacao WHERE id = ?`, [saldoId]);
  const pags = await todos<{ valor: string }>(`SELECT valor FROM pagamento WHERE saldoId = ? AND deletedAt IS NULL`, [saldoId]);
  const pago = somar(...pags.map((p) => p.valor));
  let restante = somar(saldo?.valorOriginal ?? '0').minus(pago);
  if (restante.isNegative()) restante = somar('0');
  const quitado = restante.lessThanOrEqualTo(0);
  // atualização otimista SEM mexer no _syncStatus (servidor é a verdade)
  await executar(
    `UPDATE saldo_devedor_locacao SET valorRestante=?, status=?, dataQuitacao=? WHERE id=?`,
    [restante.toFixed(2), quitado ? 'QUITADO' : 'PENDENTE', quitado ? agora : null, saldoId],
  );
  return { restante: restante.toFixed(2) };
}

/** Cobranças de um cliente (todas as locações dele), mais recentes primeiro. */
export const cobrancasDoCliente = (clienteId: string) =>
  todos(`SELECT c.*, p.plaqueta, p.descricao AS produtoDescricao
          FROM cobranca c
          JOIN locacao l ON l.id = c.locacaoId
          JOIN produto p ON p.id = l.produtoId
          WHERE l.clienteId = ? AND c.deletedAt IS NULL
          ORDER BY c.dataCobranca DESC`, [clienteId]);

/** Uma cobrança + seus pagamentos. */
export async function cobrancaComPagamentos(cobrancaId: string) {
  const cobranca = await um(`SELECT c.*, p.plaqueta, p.descricao AS produtoDescricao
     FROM cobranca c JOIN locacao l ON l.id=c.locacaoId JOIN produto p ON p.id=l.produtoId WHERE c.id = ?`, [cobrancaId]);
  const pagamentos = await todos(`SELECT * FROM pagamento WHERE cobrancaId = ? AND deletedAt IS NULL ORDER BY dataPagamento`, [cobrancaId]);
  return { cobranca, pagamentos };
}

/** Relatório de cobranças do período (totais locais). */
export async function relatorioCobrancas(deISO: string, ateISO: string) {
  const cobr = await todos<{ valorLiquidoBase: string }>(
    `SELECT valorLiquidoBase FROM cobranca WHERE dataCobranca >= ? AND dataCobranca <= ? AND deletedAt IS NULL`, [deISO, ateISO]);
  const pags = await todos<{ valor: string; formaPagamento: string }>(
    `SELECT valor, formaPagamento FROM pagamento WHERE dataPagamento >= ? AND dataPagamento <= ? AND deletedAt IS NULL`, [deISO, ateISO]);
  const totalBase = somar(...cobr.map((c) => c.valorLiquidoBase)).toFixed(2);
  const totalRecebido = somar(...pags.map((p) => p.valor)).toFixed(2);
  const porForma: Record<string, string> = {};
  for (const p of pags) porForma[p.formaPagamento] = somar(porForma[p.formaPagamento] ?? '0', p.valor).toFixed(2);
  return { quantidade: cobr.length, totalBase, totalRecebido, porForma };
}

// ---------------------------------------------------------------------------
// FINALIZAÇÃO DE LOCAÇÃO (offline) — libera o produto para nova locação em campo
// ---------------------------------------------------------------------------

/** Depósitos disponíveis para a finalização. */
export const listarDepositos = () => todos(`SELECT * FROM deposito WHERE deletedAt IS NULL ORDER BY nome`);

/**
 * Finaliza uma locação OFFLINE:
 *  1) se há saldo devedor, grava um SaldoDevedorLocacao ('created') com valorOriginal = saldo
 *     (o servidor deriva valorRestante/status); o saldo do cliente persiste após o encerramento;
 *  2) encerra a locação (status FINALIZADA), o que LIBERA o produto (deixa de ser 'ATIVA'),
 *     permitindo criar nova locação do mesmo produto ainda sem internet.
 * Todos os campos usados (status, finalizacaoTipo, depositoId, valorOriginal) estão no allowlist do sync.
 * version NÃO é incrementada localmente (o servidor resolve no pull).
 */
export async function finalizarLocacao(locacaoId: string, opts: { tipo: 'DEPOSITO' | 'RELOCACAO'; depositoId?: string }): Promise<{ saldoGerado: boolean; valor: string }> {
  const l = await um<any>(`SELECT l.*, p.plaqueta, p.descricao AS pdesc FROM locacao l JOIN produto p ON p.id = l.produtoId WHERE l.id = ?`, [locacaoId]);
  if (!l) throw new Error('Locação não encontrada.');
  if (l.status !== 'ATIVA') throw new Error('Esta locação já está finalizada.');
  const saldo = somar(l.saldoDevedorAtual ?? '0');
  const gerar = saldo.greaterThan(0);
  const agora = new Date().toISOString(); const lm = Date.now();
  const descricao = `${l.plaqueta} ${l.pdesc ?? ''}`.trim();

  await emTransacao(async (db) => {
    if (gerar) {
      await db.runAsync(
        `INSERT INTO saldo_devedor_locacao (id, locacaoId, clienteId, produtoDescricao, valorOriginal, valorRestante, status, version, updatedAt, _syncStatus, _lastModified)
         VALUES (?,?,?,?,?,?, 'PENDENTE', 0, ?, 'created', ?)`,
        [uuid(), locacaoId, l.clienteId, descricao, saldo.toFixed(2), saldo.toFixed(2), agora, lm],
      );
    }
    await db.runAsync(
      `UPDATE locacao SET status='FINALIZADA', dataFim=?, finalizacaoTipo=?, depositoId=?, updatedAt=?,
         _syncStatus = CASE WHEN _syncStatus = 'created' THEN 'created' ELSE 'updated' END, _lastModified=? WHERE id=?`,
      [agora, opts.tipo, opts.depositoId ?? null, agora, lm, locacaoId],
    );
  });
  return { saldoGerado: gerar, valor: saldo.toFixed(2) };
}

/**
 * Lista de cobrança: clientes com algo a cobrar, somando
 *  - locações ATIVAS com saldo devedor (> 0), e
 *  - saldos devedores PENDENTES de locações finalizadas (> 0).
 * Ordenado pelo total (maior primeiro). Valor é guia de campo; os valores exatos por item
 * ficam no detalhe do cliente. (Sinal: "quanto falta liquidar" — só positivos entram aqui.)
 */
export const clientesParaCobrar = () =>
  todos(`
    SELECT c.id, c.nome, c.rotaId, r.nome AS rotaNome,
      ( COALESCE((SELECT SUM(CAST(l.saldoDevedorAtual AS REAL)) FROM locacao l
                  WHERE l.clienteId = c.id AND l.status='ATIVA' AND l.deletedAt IS NULL AND CAST(l.saldoDevedorAtual AS REAL) > 0), 0)
      + COALESCE((SELECT SUM(CAST(s.valorRestante AS REAL)) FROM saldo_devedor_locacao s
                  WHERE s.clienteId = c.id AND s.status='PENDENTE' AND s.deletedAt IS NULL AND CAST(s.valorRestante AS REAL) > 0), 0)
      ) AS total,
      ( (SELECT COUNT(*) FROM locacao l WHERE l.clienteId = c.id AND l.status='ATIVA' AND l.deletedAt IS NULL AND CAST(l.saldoDevedorAtual AS REAL) > 0)
      + (SELECT COUNT(*) FROM saldo_devedor_locacao s WHERE s.clienteId = c.id AND s.status='PENDENTE' AND s.deletedAt IS NULL AND CAST(s.valorRestante AS REAL) > 0)
      ) AS pendencias,
      (SELECT MAX(c2.dataCobranca) FROM cobranca c2 JOIN locacao l2 ON l2.id = c2.locacaoId
        WHERE l2.clienteId = c.id AND c2.deletedAt IS NULL) AS ultimaCobranca
    FROM cliente c
    LEFT JOIN rota r ON r.id = c.rotaId
    WHERE c.deletedAt IS NULL
    GROUP BY c.id
    HAVING total > 0
    ORDER BY total DESC`);

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO DO APP (chave/valor em sync_meta) + cobrança rápida
// ---------------------------------------------------------------------------
const K_DIAS_ATRASO = 'config.diasAtraso';
const DIAS_ATRASO_PADRAO = 30;

/** Dias sem cobrar para sinalizar atraso (padrão 30). */
export async function obterDiasAtraso(): Promise<number> {
  const v = await obterMeta(K_DIAS_ATRASO);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DIAS_ATRASO_PADRAO;
}
export const definirDiasAtraso = (dias: number) => definirMeta(K_DIAS_ATRASO, String(Math.max(1, Math.floor(dias))));

/**
 * Locações ATIVAS com saldo (> 0) de um cliente, prontas para cobrança.
 * Usada no atalho "Cobrar agora": se houver exatamente uma, vai direto à tela de cobrança.
 */
export const locacoesParaCobrarDoCliente = (clienteId: string) =>
  todos(`SELECT l.*, p.plaqueta, p.descricao AS produtoDescricao
         FROM locacao l JOIN produto p ON p.id = l.produtoId
         WHERE l.clienteId = ? AND l.status='ATIVA' AND l.deletedAt IS NULL AND CAST(l.saldoDevedorAtual AS REAL) > 0
         ORDER BY p.plaqueta`, [clienteId]);
