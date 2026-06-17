/**
 * Harness da finalização de locação + re-locação offline (lógica espelhada do sync.service).
 * Cobre as regras que tornam o fluxo de campo seguro:
 *  - derivação de `chaveProdutoAtivo` a partir do status (índice único "1 ativo por produto");
 *  - aplicação de finalizações/exclusões ANTES das ativações no lote de `locacao`;
 *  - inicialização de `valorRestante = valorOriginal` ao inserir SaldoDevedorLocacao.
 * Standalone (sem dependências). Rodar: `node packages/api/test/finalizacao-harness.js`.
 */

// --- modelo do índice único chaveProdutoAtivo + ordenação do lote ---
function aplicarLoteLocacao(estadoInicial, lote, ordenar = true) {
  const claimByLoc = new Map(Object.entries(estadoInicial)); // locId -> produtoId (ATIVA)
  const claimed = new Map();
  for (const [loc, prod] of claimByLoc) claimed.set(prod, loc);

  let itens = lote.slice();
  if (ordenar) {
    const peso = (x) => (x.deletedAt || x.status === 'FINALIZADA' ? 0 : 1);
    itens.sort((a, b) => peso(a) - peso(b));
  }
  for (const it of itens) {
    const ativa = it.status === 'ATIVA' && !it.deletedAt;
    const chave = ativa ? it.produtoId : null; // derivação do servidor
    const antiga = claimByLoc.get(it.id);
    if (antiga && antiga !== chave) { claimed.delete(antiga); claimByLoc.delete(it.id); }
    if (chave) {
      const dono = claimed.get(chave);
      if (dono && dono !== it.id) throw new Error(`UNIQUE chaveProdutoAtivo: produto ${chave} já ativo em ${dono}`);
      claimed.set(chave, it.id); claimByLoc.set(it.id, chave);
    }
  }
  return [...claimed.keys()]; // produtos atualmente ativos
}

// --- inicialização do saldo recém-criado (valorRestante derivado) ---
function inicializarSaldo(dados, pagamentos = []) {
  const valorRestante = (dados.valorRestante == null) ? (dados.valorOriginal ?? '0') : dados.valorRestante;
  const status = dados.status ?? 'PENDENTE';
  // recálculo pelo(s) pagamento(s) (centavos para evitar float)
  const orig = Math.round(parseFloat(dados.valorOriginal || '0') * 100);
  const pago = pagamentos.reduce((a, p) => a + Math.round(parseFloat(p) * 100), 0);
  let rest = Math.max(0, orig - pago);
  return { valorRestante: (rest / 100).toFixed(2), status: rest <= 0 ? 'QUITADO' : status, inicialOk: valorRestante === (dados.valorOriginal ?? '0') };
}

let ok = 0, tot = 0;
function t(nome, fn, esperaErro = false) {
  tot++;
  try { fn(); if (esperaErro) console.log(`  FALHA ${nome}: esperava erro`); else { ok++; console.log(`  OK ${nome}`); } }
  catch (e) { if (esperaErro) { ok++; console.log(`  OK ${nome} (bloqueado)`); } else console.log(`  FALHA ${nome}: ${e.message}`); }
}

// A) finalizar + relocar mesmo produto (com ordenação do servidor) -> sem violação
t('A finalizar+relocar mesmo produto (ordenado)', () => {
  const fim = aplicarLoteLocacao({ locA: 'P' }, [
    { id: 'locB', produtoId: 'P', status: 'ATIVA' },
    { id: 'locA', produtoId: 'P', status: 'FINALIZADA' },
  ]);
  if (!(fim.length === 1 && fim[0] === 'P')) throw new Error('estado final inesperado');
});
// B) mesma carga SEM ordenar -> violaria (prova a necessidade da ordem)
t('B sem ordenar deve violar', () => {
  aplicarLoteLocacao({ locA: 'P' }, [
    { id: 'locB', produtoId: 'P', status: 'ATIVA' },
    { id: 'locA', produtoId: 'P', status: 'FINALIZADA' },
  ], false);
}, true);
// C) duas ATIVAS no mesmo produto -> bloqueado (proteção intacta)
t('C duas ativas mesmo produto deve violar', () => {
  aplicarLoteLocacao({}, [
    { id: 'locB', produtoId: 'P', status: 'ATIVA' },
    { id: 'locC', produtoId: 'P', status: 'ATIVA' },
  ]);
}, true);
// D) finalizar libera o produto
t('D finalizar libera produto', () => {
  const fim = aplicarLoteLocacao({ locA: 'P' }, [{ id: 'locA', produtoId: 'P', status: 'FINALIZADA' }]);
  if (fim.length !== 0) throw new Error('produto deveria ficar livre');
});
// E) exclusão (tombstone) também libera
t('E exclusão libera produto', () => {
  const fim = aplicarLoteLocacao({ locA: 'P' }, [{ id: 'locA', produtoId: 'P', status: 'ATIVA', deletedAt: '2026-01-01' }]);
  if (fim.length !== 0) throw new Error('produto deveria ficar livre');
});
// F) saldo novo sem pagamentos: valorRestante = valorOriginal, PENDENTE
t('F saldo novo inicia restante=original/PENDENTE', () => {
  const r = inicializarSaldo({ valorOriginal: '73.50' }, []);
  if (!(r.inicialOk && r.valorRestante === '73.50' && r.status === 'PENDENTE')) throw new Error(JSON.stringify(r));
});
// G) saldo com pagamento total -> QUITADO
t('G saldo quitado por pagamentos', () => {
  const r = inicializarSaldo({ valorOriginal: '73.50' }, ['23.50', '50.00']);
  if (!(r.valorRestante === '0.00' && r.status === 'QUITADO')) throw new Error(JSON.stringify(r));
});

console.log(`\nResultado: ${ok}/${tot} verificações de finalização/re-locação passaram.`);
process.exit(ok === tot ? 0 : 1);
