import { v4 as uuid } from '../utils/uuid';
import { todos, obterMeta, definirMeta, emTransacao } from '../db/database';
import { REGISTROS, PORTABELA, CAMPOS_BOOL, CAMPOS_JSON } from './entidades';
import { api } from './api';

// cache de colunas por tabela (via PRAGMA), para upsert genérico seguro
const colunasCache: Record<string, string[]> = {};
async function colunasDe(tabela: string): Promise<string[]> {
  if (colunasCache[tabela]) return colunasCache[tabela];
  const info = await todos<{ name: string }>(`PRAGMA table_info(${tabela})`);
  return (colunasCache[tabela] = info.map((c) => c.name));
}

/** Converte um valor do servidor para o formato de coluna SQLite. */
function paraSqlite(campo: string, valor: any): any {
  if (valor === null || valor === undefined) return null;
  if (CAMPOS_BOOL.has(campo)) return valor ? 1 : 0;
  if (CAMPOS_JSON.has(campo)) return typeof valor === 'string' ? valor : JSON.stringify(valor);
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  return valor;
}

async function upsert(db: any, tabela: string, registro: any) {
  const cols = await colunasDe(tabela);
  const campos = Object.keys(registro).filter((k) => cols.includes(k));
  const valores = campos.map((c) => paraSqlite(c, registro[c]));
  // metadados: vindo do servidor é canônico => synced
  campos.push('_syncStatus', '_lastModified'); valores.push('synced', Date.now());
  const placeholders = campos.map(() => '?').join(', ');
  const update = campos.map((c) => `${c} = excluded.${c}`).join(', ');
  await db.runAsync(
    `INSERT INTO ${tabela} (${campos.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${update}`, valores,
  );
}

/** PULL: baixa mudanças, aplica tombstones e guarda o relógio do servidor. */
export async function pull(): Promise<void> {
  const lastPulledAt = await obterMeta('lastPulledAt');
  const resp = await api.post('/sync/pull', { lastPulledAt, fullSync: !lastPulledAt });
  await emTransacao(async (db) => {
    for (const [entidade, registros] of Object.entries(resp.mudancas ?? {})) {
      const reg = PORTABELA[entidade]; if (!reg) continue;
      for (const r of registros as any[]) {
        if (r.deletedAt) { await db.runAsync(`DELETE FROM ${reg.tabela} WHERE id = ?`, [r.id]); continue; } // tombstone
        await upsert(db, reg.tabela, r);
      }
    }
  });
  await definirMeta('lastPulledAt', resp.serverTimestamp); // [AUDIT P0] relógio do servidor
}

/** Prepara uma linha local para envio ao servidor (tira metadados, ajusta tipos). */
function paraServidor(linha: any): any {
  const out: any = {};
  for (const [k, v] of Object.entries(linha)) {
    if (k === '_syncStatus' || k === '_lastModified') continue;
    if (v === null) continue;
    if (CAMPOS_BOOL.has(k)) out[k] = v === 1 || v === true;
    else if (CAMPOS_JSON.has(k)) { try { out[k] = JSON.parse(v as string); } catch { out[k] = v; } }
    else out[k] = v;
  }
  return out;
}

/** PUSH: envia registros sujos; marca como synced os aceitos (conflitos voltam corrigidos no pull). */
export async function push(): Promise<{ conflitos: { entidade: string; id: string }[] }> {
  const mudancas: Record<string, any[]> = {};
  for (const reg of REGISTROS.filter((r) => r.pushable)) {
    const linhas = await todos(`SELECT * FROM ${reg.tabela} WHERE _syncStatus != 'synced'`);
    if (linhas.length) mudancas[reg.entidade] = linhas.map(paraServidor);
  }
  if (Object.keys(mudancas).length === 0) return { conflitos: [] };

  const resp = await api.post('/sync/push', { idempotencyKey: uuid(), mudancas });
  const conflitos = new Set((resp.conflitos ?? []).map((c: any) => `${c.entidade}:${c.id}`));

  await emTransacao(async (db) => {
    for (const reg of REGISTROS.filter((r) => r.pushable)) {
      const linhas = mudancas[reg.entidade]; if (!linhas) continue;
      for (const l of linhas) {
        if (conflitos.has(`${reg.entidade}:${l.id}`)) continue; // servidor venceu; pull corrige
        await db.runAsync(`UPDATE ${reg.tabela} SET _syncStatus = 'synced' WHERE id = ?`, [l.id]);
      }
    }
  });
  return resp;
}

/** Ciclo completo: envia o que foi feito em campo, depois baixa o estado canônico. */
export async function sincronizar(): Promise<{ conflitos: { entidade: string; id: string }[] }> {
  const r = await push();
  await pull();
  return r;
}
