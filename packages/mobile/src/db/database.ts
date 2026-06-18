import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Abre (uma vez) e migra o banco local. Memoriza a PROMESSA de inicialização — não o objeto —
 * para que todos os chamadores concorrentes do boot aguardem o MESMO init (abrir → PRAGMA → schema)
 * e nunca consultem o banco antes do schema existir.
 */
export function obterDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('locacoes.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await db.execAsync(SCHEMA_SQL);
      return db;
    })().catch((e) => { _dbPromise = null; throw e; }); // se falhar, permite nova tentativa
  }
  return _dbPromise;
}

export async function todos<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await obterDb();
  return db.getAllAsync<T>(sql, params);
}
export async function um<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const db = await obterDb();
  return (await db.getFirstAsync<T>(sql, params)) ?? null;
}
export async function executar(sql: string, params: any[] = []): Promise<void> {
  const db = await obterDb();
  await db.runAsync(sql, params);
}
export async function emTransacao(fn: (db: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
  const db = await obterDb();
  await db.withTransactionAsync(async () => { await fn(db); });
}

export async function obterMeta(chave: string): Promise<string | null> {
  const r = await um<{ valor: string }>('SELECT valor FROM sync_meta WHERE chave = ?', [chave]);
  return r?.valor ?? null;
}
export async function definirMeta(chave: string, valor: string): Promise<void> {
  await executar('INSERT INTO sync_meta(chave, valor) VALUES(?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor', [chave, valor]);
}
