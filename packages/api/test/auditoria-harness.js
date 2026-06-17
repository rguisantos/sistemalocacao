/**
 * Harness do `sanitizar` da auditoria (lógica pura espelhada de comum/auditoria/auditoria.service.ts).
 * Garante que o payload gravado em LogAuditoria é serializável em JSON: converte Prisma.Decimal e Date,
 * redige campos sensíveis (inclusive aninhados/em arrays) e nunca deixa métodos/funções no resultado —
 * o bug que derrubava os e2e (PrismaClientValidationError: "[object Function]").
 * Standalone. Rodar: `node packages/api/test/auditoria-harness.js`.
 */
const CAMPOS_SENSIVEIS = new Set(['senha', 'senhaAtual', 'novaSenha', 'token', 'accessToken', 'refreshToken', 'tokenVersao']);

function sanitizar(dados) {
  if (dados === null || dados === undefined) return dados;
  if (typeof dados !== 'object') return dados;
  if (dados instanceof Date) return dados.toISOString();
  if (Array.isArray(dados)) return dados.map(sanitizar);
  const proto = Object.getPrototypeOf(dados);
  if (proto !== Object.prototype && proto !== null) {
    return typeof dados.toString === 'function' ? String(dados) : undefined;
  }
  const out = {};
  for (const [k, v] of Object.entries(dados)) out[k] = CAMPOS_SENSIVEIS.has(k) ? '[REMOVIDO]' : sanitizar(v);
  return out;
}

// imita o Prisma.Decimal (decimal.js): classe com toString numérico + métodos.
class Decimal { constructor(v) { this.v = v; } toString() { return this.v; } plus() {} }

let ok = 0, tot = 0;
const t = (nome, cond) => { tot++; if (cond) { ok++; console.log('  OK ' + nome); } else console.log('  FALHA ' + nome); };

const entrada = {
  valorFixo: new Decimal('100.00'), saldoDevedorAtual: new Decimal('0.00'),
  dataInicio: new Date('2026-06-16T12:00:00.000Z'), nome: 'João', senha: 'hash',
  nested: { token: 'abc', valor: new Decimal('45.50'), ok: true },
  lista: [new Decimal('1.5'), { refreshToken: 'r' }], nulo: null, n: 5, b: false,
};
const out = sanitizar(entrada);
const json = JSON.stringify(out);

t('Decimal -> string', out.valorFixo === '100.00');
t('Decimal zero -> "0.00"', out.saldoDevedorAtual === '0.00');
t('Date -> ISO', out.dataInicio === '2026-06-16T12:00:00.000Z');
t('campo normal preservado', out.nome === 'João');
t('senha redigida', out.senha === '[REMOVIDO]');
t('token aninhado redigido', out.nested.token === '[REMOVIDO]');
t('Decimal aninhado convertido', out.nested.valor === '45.50');
t('bool preservado', out.nested.ok === true);
t('Decimal em array convertido', out.lista[0] === '1.5');
t('refreshToken em array redigido', out.lista[1].refreshToken === '[REMOVIDO]');
t('null/number/false preservados', out.nulo === null && out.n === 5 && out.b === false);
t('JSON sem [Function] (não quebra o Prisma)', !json.includes('Function'));
t('primitivos passam direto', sanitizar('x') === 'x' && sanitizar(3) === 3 && sanitizar(null) === null);

console.log(`\nResultado: ${ok}/${tot} verificações da auditoria (sanitizar) passaram.`);
process.exit(ok === tot ? 0 : 1);
