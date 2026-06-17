/**
 * Harness do cliente de sync (espelha pull/push de sync-client.ts) sobre um
 * "SQLite" em memória, para validar: upsert no pull, aplicação de tombstone,
 * coleta de sujos no push, marcação de synced e tratamento de conflito.
 */
const assert = require('assert');

function fakeDb() {
  const tabelas = { cliente: new Map(), cobranca: new Map() };
  const meta = new Map();
  return {
    upsert(tab, reg) { tabelas[tab].set(reg.id, { ...(tabelas[tab].get(reg.id) || {}), ...reg, _syncStatus: 'synced' }); },
    del(tab, id) { tabelas[tab].delete(id); },
    inserirLocal(tab, reg) { tabelas[tab].set(reg.id, { ...reg, _syncStatus: reg._syncStatus || 'created' }); },
    sujos(tab) { return [...tabelas[tab].values()].filter((r) => r._syncStatus !== 'synced'); },
    marcarSynced(tab, id) { const r = tabelas[tab].get(id); if (r) r._syncStatus = 'synced'; },
    get(tab, id) { return tabelas[tab].get(id); },
    todos(tab) { return [...tabelas[tab].values()]; },
    metaGet(k) { return meta.get(k) ?? null; },
    metaSet(k, v) { meta.set(k, v); },
  };
}

// PULL: aplica upsert e tombstone; guarda serverTimestamp
function aplicarPull(db, resp) {
  for (const [tab, regs] of Object.entries(resp.mudancas)) {
    for (const r of regs) { if (r.deletedAt) db.del(tab, r.id); else db.upsert(tab, r); }
  }
  db.metaSet('lastPulledAt', resp.serverTimestamp);
}
// PUSH: coleta sujos, "envia", marca synced exceto conflitos
function aplicarPush(db, enviar, respConflitos) {
  const mudancas = {};
  for (const tab of ['cliente', 'cobranca']) { const s = db.sujos(tab); if (s.length) mudancas[tab] = s.map((r) => ({ ...r })); }
  const resp = enviar(mudancas); // simula servidor
  const conflitos = new Set((resp.conflitos || []).map((c) => `${c.entidade}:${c.id}`));
  for (const tab of Object.keys(mudancas)) for (const r of mudancas[tab]) {
    if (!conflitos.has(`${tab}:${r.id}`)) db.marcarSynced(tab, r.id);
  }
  return resp;
}

let n = 0, ok = 0; const ck = (t, c) => { n++; if (c) ok++; else console.log('  FALHOU:', t); };

// 1) pull insere e atualiza
{
  const db = fakeDb();
  aplicarPull(db, { serverTimestamp: 'T1', mudancas: { cliente: [{ id: 'c1', nome: 'Ana', updatedAt: 'x' }] } });
  ck('pull insere c1', db.get('cliente', 'c1').nome === 'Ana');
  aplicarPull(db, { serverTimestamp: 'T2', mudancas: { cliente: [{ id: 'c1', nome: 'Ana Maria' }] } });
  ck('pull atualiza c1', db.get('cliente', 'c1').nome === 'Ana Maria');
  ck('lastPulledAt = relógio do servidor', db.metaGet('lastPulledAt') === 'T2');
}
// 2) pull com tombstone remove local
{
  const db = fakeDb();
  db.upsert('cliente', { id: 'c2', nome: 'X' });
  aplicarPull(db, { serverTimestamp: 'T3', mudancas: { cliente: [{ id: 'c2', deletedAt: 'now' }] } });
  ck('tombstone remove c2', db.get('cliente', 'c2') === undefined);
}
// 3) push coleta só sujos e marca synced
{
  const db = fakeDb();
  db.upsert('cliente', { id: 'limpo' });                 // synced -> não envia
  db.inserirLocal('cobranca', { id: 'cob1', valorLiquidoBase: '100.00' }); // created -> envia
  let recebido = null;
  aplicarPush(db, (m) => { recebido = m; return { conflitos: [] }; });
  ck('push envia só o sujo', recebido.cobranca && recebido.cobranca.length === 1 && !recebido.cliente);
  ck('sujo vira synced após push', db.get('cobranca', 'cob1')._syncStatus === 'synced');
}
// 4) conflito no push mantém o registro sujo (será corrigido no pull)
{
  const db = fakeDb();
  db.inserirLocal('cliente', { id: 'cC', nome: 'Local', _syncStatus: 'updated' });
  aplicarPush(db, () => ({ conflitos: [{ entidade: 'cliente', id: 'cC' }] }));
  ck('conflito mantém sujo', db.get('cliente', 'cC')._syncStatus === 'updated');
}

console.log(`\nResultado: ${ok}/${n} verificações do cliente de sync passaram.`);
process.exit(ok === n ? 0 : 1);
