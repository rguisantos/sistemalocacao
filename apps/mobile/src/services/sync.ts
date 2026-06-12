// apps/mobile/src/services/sync.ts
// ============================================================
// ENGINE DE SINCRONIZAÇÃO OFFLINE-FIRST
// Push: envia registros locais pendentes (UUID + version).
// Pull: baixa alterações incrementais desde lastSyncTimestamp.
// Conflitos: servidor vence (last-write-wins); dados do servidor
// substituem os locais e o registro sai da fila.
// ============================================================
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { db, getMeta, setMeta } from '../db/schema';
import { api } from './api';

export const uuid = () => Crypto.randomUUID();

interface PushRecord {
  id: string;
  entidade: string;
  operacao: 'create' | 'update' | 'delete';
  version: number;
  baseVersion?: number; // versão do servidor quando o registro foi baixado
  dados: Record<string, unknown>;
}

interface PushResult {
  id: string;
  status: 'applied' | 'merged' | 'conflict' | 'error';
  mensagem?: string;
  dadosServidor?: Record<string, unknown>;
}

let sincronizando = false;

export async function estaOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!state.isConnected && state.isInternetReachable !== false;
}

// ------------------------------------------------------------
// PUSH
// ------------------------------------------------------------
function coletarPendentes(): PushRecord[] {
  const registros: PushRecord[] = [];
  const mapearOp = (s: string): 'create' | 'update' | 'delete' =>
    s === 'PENDING_CREATE' ? 'create' : s === 'PENDING_DELETE' ? 'delete' : 'update';

  // Clientes e endereços criados/editados offline
  const clientes = db.getAllSync<any>(
    `SELECT * FROM clientes WHERE sync_status NOT IN ('SYNCED','SYNC_ERROR')`
  );
  for (const c of clientes) {
    registros.push({
      id: c.id,
      entidade: 'clientes',
      operacao: mapearOp(c.sync_status),
      version: c.version,
      baseVersion: c.base_version ?? 0,
      dados: {
        tipo: c.tipo,
        nome: c.nome,
        razaoSocial: c.razao_social,
        cpfCnpj: c.cpf_cnpj,
        rgInscricaoEstadual: c.rg_inscricao_estadual,
        telefones: JSON.parse(c.telefones || '[]'),
        rotaId: c.rota_id,
        observacoes: c.observacoes,
        ativo: !!c.ativo,
      },
    });
  }

  const enderecos = db.getAllSync<any>(
    `SELECT * FROM enderecos WHERE sync_status NOT IN ('SYNCED','SYNC_ERROR')`
  );
  for (const e of enderecos) {
    registros.push({
      id: e.id,
      entidade: 'enderecos',
      operacao: mapearOp(e.sync_status),
      version: e.version,
      baseVersion: e.base_version ?? 0,
      dados: {
        clienteId: e.cliente_id,
        logradouro: e.logradouro,
        numero: e.numero,
        complemento: e.complemento,
        bairro: e.bairro,
        cidade: e.cidade,
        estado: e.estado,
        cep: e.cep,
        latitude: e.latitude ? Number(e.latitude) : null,
        longitude: e.longitude ? Number(e.longitude) : null,
        principal: !!e.principal,
      },
    });
  }

  const locacoes = db.getAllSync<any>(
    `SELECT * FROM locacoes WHERE sync_status NOT IN ('SYNCED','SYNC_ERROR') ORDER BY data_inicio ASC`
  );
  for (const l of locacoes) {
    registros.push({
      id: l.id,
      entidade: 'locacoes',
      operacao: mapearOp(l.sync_status),
      version: l.version,
      baseVersion: l.base_version ?? 0,
      dados: {
        produtoId: l.produto_id,
        clienteId: l.cliente_id,
        enderecoId: l.endereco_id,
        regra: l.regra,
        frequencia: l.frequencia,
        valorFixo: l.valor_fixo,
        valorPartida: l.valor_partida,
        percentual: l.percentual,
        contadorInicial: l.contador_inicial,
        dataInicio: l.data_inicio,
        dataFim: l.data_fim,
        status: l.status,
        finalizacaoTipo: l.finalizacao_tipo,
        depositoId: l.deposito_id,
      },
    });
  }


  // Cobranças por ÚLTIMO: dependem de locações (que dependem de clientes/endereços)
  const cobrancas = db.getAllSync<any>(
    `SELECT * FROM cobrancas WHERE sync_status = 'PENDING_CREATE' ORDER BY data_cobranca ASC`
  );
  for (const c of cobrancas) {
    registros.push({
      id: c.id,
      entidade: 'cobrancas',
      operacao: 'create',
      version: c.version,
      dados: {
        locacaoId: c.locacao_id,
        contadorAtual: c.contador_atual,
        descontoPartidas: c.desconto_partidas,
        acrescimo: c.acrescimo,
        descontoValorReceber: c.desconto_valor_receber,
        valorRecebidoPago: c.valor_recebido_pago,
        formaPagamento: c.forma_pagamento,
        trocaPano: !!c.troca_pano,
        observacoes: c.observacoes,
        dataCobranca: c.data_cobranca,
      },
    });
  }


  return registros;
}

/** Sobrescreve o registro local com o estado autoritativo do servidor */
function aplicarDadosServidor(tabela: string, id: string, d: Record<string, any>) {
  const v = Number(d.version ?? Date.now());
  if (tabela === 'clientes') {
    db.runSync(
      `UPDATE clientes SET tipo=?, nome=?, razao_social=?, cpf_cnpj=?, rg_inscricao_estadual=?,
       telefones=?, rota_id=?, observacoes=?, ativo=?, version=?, base_version=?, sync_status='SYNCED'
       WHERE id = ?`,
      [d.tipo, d.nome, d.razaoSocial ?? null, d.cpfCnpj ?? null, d.rgInscricaoEstadual ?? null,
       JSON.stringify(d.telefones ?? []), d.rotaId, d.observacoes ?? null,
       d.ativo ? 1 : 0, v, v, id]
    );
  } else if (tabela === 'enderecos') {
    db.runSync(
      `UPDATE enderecos SET logradouro=?, numero=?, complemento=?, bairro=?, cidade=?, estado=?,
       cep=?, latitude=?, longitude=?, principal=?, version=?, base_version=?, sync_status='SYNCED'
       WHERE id = ?`,
      [d.logradouro, d.numero, d.complemento ?? null, d.bairro, d.cidade, d.estado, d.cep,
       d.latitude != null ? String(d.latitude) : null,
       d.longitude != null ? String(d.longitude) : null,
       d.principal ? 1 : 0, v, v, id]
    );
  }
}

const TABELA_LOCAL: Record<string, string> = {
  cobrancas: 'cobrancas',
  clientes: 'clientes',
  enderecos: 'enderecos',
  locacoes: 'locacoes',
};

async function executarPush(): Promise<{ enviados: number; conflitos: number; erros: number }> {
  const registros = coletarPendentes();
  if (registros.length === 0) return { enviados: 0, conflitos: 0, erros: 0 };

  const deviceId = getMeta('deviceId') ?? uuid();
  setMeta('deviceId', deviceId);

  let conflitos = 0;
  let erros = 0;

  // Lotes de 100 (servidor aceita até 500)
  for (let i = 0; i < registros.length; i += 100) {
    const lote = registros.slice(i, i + 100);
    const { resultados } = await api<{ resultados: PushResult[] }>('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({ deviceId, registros: lote }),
    });

    for (const r of resultados) {
      const tabela = TABELA_LOCAL[lote.find((l) => l.id === r.id)?.entidade ?? ''];
      if (!tabela) continue;

      if (r.status === 'applied' || r.status === 'merged') {
        if (r.status === 'merged') conflitos++; // mesclado automaticamente no servidor
        db.runSync(`UPDATE ${tabela} SET sync_status = 'SYNCED' WHERE id = ?`, [r.id]);
        // merged/conflict devolvem o estado do servidor: aplica localmente
        if (r.dadosServidor) aplicarDadosServidor(tabela, r.id, r.dadosServidor);
      } else if (r.status === 'conflict') {
        conflitos++;
        // Campo crítico divergente: servidor vence por ora; conflito fica
        // na fila do painel. Aplica estado do servidor localmente.
        db.runSync(`UPDATE ${tabela} SET sync_status = 'SYNCED' WHERE id = ?`, [r.id]);
        if (r.dadosServidor) aplicarDadosServidor(tabela, r.id, r.dadosServidor);
      } else {
        erros++;
        // Servidor rejeitou (validação, regra de negócio): tira da fila de
        // reenvio e registra para revisão — sem isso, o push entraria em
        // loop infinito reenviando o mesmo registro inválido para sempre.
        const opOriginal = db.getFirstSync<{ sync_status: string }>(
          `SELECT sync_status FROM ${tabela} WHERE id = ?`, [r.id]
        )?.sync_status ?? 'PENDING_UPDATE';
        db.runSync(`UPDATE ${tabela} SET sync_status = 'SYNC_ERROR' WHERE id = ?`, [r.id]);
        db.runSync(
          `INSERT OR REPLACE INTO sync_erros (registro_id, tabela, op_original, mensagem)
           VALUES (?, ?, ?, ?)`,
          [r.id, tabela, opOriginal, r.mensagem ?? 'Erro desconhecido']
        );
      }
    }
  }

  return { enviados: registros.length, conflitos, erros };
}

// ------------------------------------------------------------
// PULL
// ------------------------------------------------------------
function aplicarPull(entidades: Record<string, any[]>) {
  db.withTransactionSync(() => {
    for (const r of entidades.rotas ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO rotas (id, nome, ativo, is_deleted, version, sync_status)
         VALUES (?, ?, ?, ?, ?, 'SYNCED')`,
        [r.id, r.nome, r.ativo ? 1 : 0, r.isDeleted ? 1 : 0, Number(r.version)]
      );
    }

    for (const c of entidades.clientes ?? []) {
      // não sobrescrever alterações locais pendentes
      const local = db.getFirstSync<any>(`SELECT sync_status FROM clientes WHERE id = ?`, [c.id]);
      if (local && local.sync_status !== 'SYNCED') continue;

      db.runSync(
        `INSERT OR REPLACE INTO clientes
         (id, tipo, nome, razao_social, cpf_cnpj, rg_inscricao_estadual, telefones, rota_id, observacoes, ativo, is_deleted, version, base_version, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
        [
          c.id, c.tipo, c.nome, c.razaoSocial, c.cpfCnpj, c.rgInscricaoEstadual,
          JSON.stringify(c.telefones ?? []), c.rotaId, c.observacoes,
          c.ativo ? 1 : 0, c.isDeleted ? 1 : 0, Number(c.version), Number(c.version),
        ]
      );
      for (const e of c.enderecos ?? []) {
        const localE = db.getFirstSync<any>(`SELECT sync_status FROM enderecos WHERE id = ?`, [e.id]);
        if (localE && localE.sync_status !== 'SYNCED') continue;
        db.runSync(
          `INSERT OR REPLACE INTO enderecos
           (id, cliente_id, logradouro, numero, complemento, bairro, cidade, estado, cep, latitude, longitude, principal, is_deleted, version, base_version, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
          [
            e.id, e.clienteId, e.logradouro, e.numero, e.complemento, e.bairro,
            e.cidade, e.estado, e.cep,
            e.latitude != null ? String(e.latitude) : null,
            e.longitude != null ? String(e.longitude) : null,
            e.principal ? 1 : 0, e.isDeleted ? 1 : 0, Number(e.version), Number(e.version),
          ]
        );
      }
    }

    for (const d of entidades.depositos ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO depositos (id, nome, cidade, is_deleted, version, sync_status)
         VALUES (?, ?, ?, ?, ?, 'SYNCED')`,
        [d.id, d.nome, d.cidade ?? null, d.isDeleted ? 1 : 0, Number(d.version)]
      );
    }

    for (const p of entidades.produtos ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO produtos (id, plaqueta, tipo_produto_id, descricao, contador, is_deleted, version, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
        [p.id, p.plaqueta, p.tipoProdutoId, p.descricao, p.contador ?? 0, p.isDeleted ? 1 : 0, Number(p.version)]
      );
    }

    for (const l of entidades.locacoes ?? []) {
      const ultima = l.cobrancas?.[0];
      db.runSync(
        `INSERT OR REPLACE INTO locacoes
         (id, produto_id, cliente_id, endereco_id, regra, frequencia, valor_fixo, valor_partida, percentual,
          contador_inicial, ultimo_contador, ultima_cobranca_data, data_inicio, data_fim, status,
          finalizacao_tipo, deposito_id, saldo_atual, is_deleted, version, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
        [
          l.id, l.produtoId, l.clienteId, l.enderecoId, l.regra, l.frequencia,
          l.valorFixo, l.valorPartida, l.percentual,
          l.contadorInicial ?? 0,
          ultima?.contadorAtual ?? null,
          ultima?.dataCobranca ?? null,
          l.dataInicio, l.dataFim, l.status,
          l.finalizacaoTipo, l.depositoId,
          l.saldoAtual ?? '0',
          l.isDeleted ? 1 : 0, Number(l.version),
        ]
      );
    }

    for (const cb of entidades.cobrancas ?? []) {
      // 1) Cobrança criada NESTE aparelho: o servidor devolve com
      //    syncOrigemId = nosso UUID local → atualiza status/valores
      //    (é assim que a confirmação do PIX via webhook chega ao app).
      if (cb.syncOrigemId) {
        const local = db.getFirstSync<any>(
          `SELECT id, sync_status FROM cobrancas WHERE id = ?`, [cb.syncOrigemId]
        );
        if (local) {
          if (local.sync_status === 'SYNCED') {
            db.runSync(
              `UPDATE cobrancas SET status_pagamento = ?, valor_recebido_pago = ?,
                 saldo_resultante = ?, pix_copia_cola = COALESCE(?, pix_copia_cola)
               WHERE id = ?`,
              [cb.statusPagamento, cb.valorRecebidoPago, cb.saldoResultante,
               cb.pixCopiaCola ?? null, cb.syncOrigemId]
            );
          }
          continue; // não duplicar pelo id do servidor
        }
      }
      // 2) Cobrança de outro aparelho/painel: upsert pelo id do servidor
      //    (não tocar em registros locais ainda pendentes)
      const porId = db.getFirstSync<any>(
        `SELECT sync_status FROM cobrancas WHERE id = ?`, [cb.id]
      );
      if (porId && porId.sync_status !== 'SYNCED') continue;
      if (cb.isDeleted) {
        db.runSync(`DELETE FROM cobrancas WHERE id = ?`, [cb.id]);
        continue;
      }
      db.runSync(
        `INSERT OR REPLACE INTO cobrancas
         (id, locacao_id, usuario_id, data_cobranca, contador_anterior, contador_atual,
          valor_liquido_final, valor_recebido_pago, saldo_resultante,
          forma_pagamento, status_pagamento, cobrador_nome, troca_pano,
          pix_copia_cola, sync_status, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?)`,
        [
          cb.id, cb.locacaoId, cb.usuarioId, cb.dataCobranca,
          cb.contadorAnterior ?? null, cb.contadorAtual ?? null,
          cb.valorLiquidoFinal, cb.valorRecebidoPago, cb.saldoResultante,
          cb.formaPagamento, cb.statusPagamento, cb.usuario?.nome ?? null,
          cb.trocaPano ? 1 : 0, cb.pixCopiaCola ?? null, Number(cb.version),
        ]
      );
    }

    for (const s of entidades.saldosDevedores ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO saldos_devedores
         (id, locacao_id, cliente_id, valor_original, valor_restante, status, is_deleted, version, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
        [s.id, s.locacaoId, s.clienteId, s.valorOriginal, s.valorRestante, s.status, s.isDeleted ? 1 : 0, Number(s.version)]
      );
    }

    for (const pg of entidades.pagamentosSaldo ?? []) {
      db.runSync(
        `INSERT OR REPLACE INTO pagamentos_saldo
         (id, saldo_id, valor, forma_pagamento, data_pagamento, observacoes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pg.id, pg.saldoId, pg.valor, pg.formaPagamento, pg.dataPagamento, pg.observacoes ?? null]
      );
    }
  });
}

async function executarPull(): Promise<number> {
  const lastSync = Number(getMeta('lastSyncTimestamp') ?? 0);
  const resp = await api<{ timestamp: number; entidades: Record<string, any[]> }>(
    '/api/sync/pull',
    { method: 'POST', body: JSON.stringify({ lastSyncTimestamp: lastSync }) }
  );
  aplicarPull(resp.entidades);
  setMeta('lastSyncTimestamp', String(resp.timestamp));
  return Object.values(resp.entidades).reduce((acc, arr) => acc + arr.length, 0);
}

// ------------------------------------------------------------
// ORQUESTRAÇÃO
// ------------------------------------------------------------
export interface ResultadoSync {
  ok: boolean;
  mensagem: string;
  enviados?: number;
  recebidos?: number;
  conflitos?: number;
}

export async function sincronizar(): Promise<ResultadoSync> {
  if (sincronizando) return { ok: false, mensagem: 'Sincronização já em andamento' };
  if (!(await estaOnline())) return { ok: false, mensagem: 'Sem conexão. Dados salvos localmente.' };

  sincronizando = true;
  try {
    const push = await executarPush();       // 1º push (envia trabalho local)
    const recebidos = await executarPull();  // 2º pull (traz estado do servidor)
    return {
      ok: true,
      mensagem: 'Sincronizado',
      enviados: push.enviados,
      recebidos,
      conflitos: push.conflitos,
    };
  } catch (e: any) {
    return { ok: false, mensagem: e?.message ?? 'Falha na sincronização' };
  } finally {
    sincronizando = false;
  }
}

export function contarPendentes(): number {
  const c = db.getFirstSync<{ n: number }>(
    `SELECT
      (SELECT COUNT(*) FROM cobrancas WHERE sync_status NOT IN ('SYNCED','SYNC_ERROR')) +
      (SELECT COUNT(*) FROM clientes  WHERE sync_status NOT IN ('SYNCED','SYNC_ERROR')) +
      (SELECT COUNT(*) FROM enderecos WHERE sync_status NOT IN ('SYNCED','SYNC_ERROR')) +
      (SELECT COUNT(*) FROM locacoes  WHERE sync_status NOT IN ('SYNCED','SYNC_ERROR')) AS n`
  );
  return c?.n ?? 0;
}

export function contarErros(): number {
  const c = db.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM sync_erros`);
  return c?.n ?? 0;
}
