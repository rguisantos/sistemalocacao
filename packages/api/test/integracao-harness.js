/**
 * Harness de integração em memória — espelha a lógica de sync.service.ts e
 * cobrancas/saldo.service.ts para provar os cenários offline->online sem banco.
 */
const assert = require('assert');

// ---------- regras espelhadas do @app/core ----------
const CAMPOS_PROIBIDOS = new Set(['senha', 'tokenVersao']);
const ALLOWLIST = {
  cliente: ['id','tipo','nome','cpfCnpj','rgIe','telefones','observacoes','rotaId','updatedAt','deletedAt','version'],
  cobranca: ['id','locacaoId','usuarioId','dataCobranca','valorLiquidoBase','valorLiquidoFinal','updatedAt','deletedAt'],
  pagamento: ['id','alvo','cobrancaId','saldoId','usuarioId','valor','formaPagamento','dataPagamento','updatedAt','deletedAt'],
  usuario: ['id','pushToken','updatedAt'],
  locacao: ['id','produtoId','clienteId','enderecoId','regra','status','updatedAt','deletedAt','version'],
};
function sanitizarPush(ent, reg) {
  const ok = new Set(ALLOWLIST[ent]); const out = {};
  for (const [k,v] of Object.entries(reg)) { if (CAMPOS_PROIBIDOS.has(k)) continue; if (ok.has(k)) out[k]=v; }
  return out;
}
const ESTRAT = { cobranca:'APPEND_ONLY', pagamento:'APPEND_ONLY', cliente:'VERSIONADO', locacao:'VERSIONADO', usuario:'VERSIONADO' };
function resolver(ent, rec, atual) {
  const e = ESTRAT[ent];
  if (e==='APPEND_ONLY') return atual.existe?{acao:'IGNORAR_DUPLICADO'}:{acao:'INSERIR'};
  if (!atual.existe) return {acao:'INSERIR'};
  const vS=atual.version??0, vC=rec.version??0;
  if (vC===vS) return {acao:'ATUALIZAR', novaVersao:vS+1};
  return {acao:'CONFLITO', versaoServidor:vS, versaoCliente:vC};
}
const round2 = n => Math.round((n+Number.EPSILON)*100)/100;

// ---------- "servidor" em memória ----------
function novoServidor() {
  const db = { usuario:new Map(), rota:new Map(), usuarioRota:[], cliente:new Map(),
    locacao:new Map(), cobranca:new Map(), pagamento:new Map(), saldoDevedor:new Map(), conflito:[] };
  const redis = new Set(); // idempotência de lote
  const now = () => new Date().toISOString();

  function recalcularSaldoLocacao(locacaoId) {
    const bases = [...db.cobranca.values()].filter(c=>c.locacaoId===locacaoId && !c.deletedAt).reduce((s,c)=>s+Number(c.valorLiquidoBase),0);
    const pagos = [...db.pagamento.values()].filter(p=>!p.deletedAt && !p.estornadoPorId && p.cobrancaId && db.cobranca.get(p.cobrancaId)?.locacaoId===locacaoId).reduce((s,p)=>s+Number(p.valor),0);
    const saldo = round2(bases - pagos);
    const loc = db.locacao.get(locacaoId); if (loc) loc.saldoDevedorAtual = saldo;
    return saldo;
  }

  function rotasDoUsuario(uid){ return db.usuarioRota.filter(x=>x.usuarioId===uid).map(x=>x.rotaId); }

  function pull(uid, lastPulledAt, fullSync=false) {
    const rotas = new Set(rotasDoUsuario(uid));
    const desde = (!fullSync && lastPulledAt) ? new Date(lastPulledAt) : null;
    const recente = r => !desde || new Date(r.updatedAt) > desde;
    const clientes = [...db.cliente.values()].filter(c=>rotas.has(c.rotaId) && recente(c)); // inclui tombstones
    const usuarios = [...db.usuario.values()].filter(u=>u.id===uid).map(u=>({id:u.id,nome:u.nome,cpf:u.cpf,pushToken:u.pushToken,updatedAt:u.updatedAt})); // sem senha
    return { serverTimestamp: now(), mudancas: { cliente:clientes, usuario:usuarios } };
  }

  function push(uid, idempotencyKey, mudancas) {
    const chave = `${uid}:${idempotencyKey}`;
    if (redis.has(chave)) return { jaProcessado:true, conflitos:[] };
    redis.add(chave);
    const conflitos = []; const locAfetadas = new Set();
    for (const ent of Object.keys(mudancas)) {
      for (const bruto of mudancas[ent]) {
        const limpo = sanitizarPush(ent, bruto);
        if (!limpo.id) continue;
        const atualReg = db[ent==='usuario'?'usuario':ent]?.get?.(limpo.id);
        const dec = resolver(ent, limpo, { existe: !!atualReg, version: atualReg?.version });
        if (dec.acao==='IGNORAR_DUPLICADO') continue;
        if (dec.acao==='CONFLITO') { db.conflito.push({ent,id:limpo.id,...dec}); conflitos.push({ent,id:limpo.id}); continue; }
        const tabela = db[ent];
        if (dec.acao==='INSERIR') {
          tabela.set(limpo.id, { ...(ent!=='usuario'?{}:atualReg), ...limpo, updatedAt: now() });
        } else if (dec.acao==='ATUALIZAR') {
          // concorrência otimista: confere versão novamente
          const cur = tabela.get(limpo.id);
          if ((cur.version??0) !== dec.novaVersao-1) { conflitos.push({ent,id:limpo.id}); continue; }
          tabela.set(limpo.id, { ...cur, ...limpo, version: dec.novaVersao, updatedAt: now() });
        }
        if (ent==='cobranca') locAfetadas.add(limpo.locacaoId);
        if (ent==='pagamento' && limpo.cobrancaId) { const c=db.cobranca.get(limpo.cobrancaId); if (c) locAfetadas.add(c.locacaoId); }
      }
    }
    for (const l of locAfetadas) recalcularSaldoLocacao(l);
    return { serverTimestamp: now(), conflitos };
  }

  return { db, pull, push, recalcularSaldoLocacao };
}

// ---------- seed ----------
const S = novoServidor();
S.db.usuario.set('u1', { id:'u1', nome:'Cobrador', cpf:'11111111111', senha:'HASH_ORIGINAL', tokenVersao:0, version:0, updatedAt:new Date('2025-01-01').toISOString() });
S.db.rota.set('rA',{id:'rA',nome:'Zona A'}); S.db.rota.set('rB',{id:'rB',nome:'Zona B'});
S.db.usuarioRota.push({usuarioId:'u1',rotaId:'rA'}); // u1 só vê rota A
S.db.cliente.set('cA',{id:'cA',nome:'Cliente A',rotaId:'rA',version:0,updatedAt:new Date('2025-02-01').toISOString()});
S.db.cliente.set('cB',{id:'cB',nome:'Cliente B',rotaId:'rB',version:0,updatedAt:new Date('2025-02-01').toISOString()});
S.db.locacao.set('locA',{id:'locA',clienteId:'cA',regra:'VALOR_FIXO',status:'ATIVA',saldoDevedorAtual:0,version:0,updatedAt:new Date('2025-02-01').toISOString()});

let n=0, ok=0; const ck=(t,c)=>{n++; if(c)ok++; else console.log('  FALHOU:',t);};

// 1) PULL escopado por rota: u1 vê cliente da rota A, nunca o da rota B
{
  const r = S.pull('u1', null, true);
  const ids = r.mudancas.cliente.map(c=>c.id);
  ck('pull traz cliente da rota A', ids.includes('cA'));
  ck('pull NÃO traz cliente da rota B (anti-IDOR)', !ids.includes('cB'));
  ck('pull de usuario nunca traz senha', !('senha' in r.mudancas.usuario[0]));
}

// 2) PUSH idempotente por lote: reenvio do mesmo lote não duplica
{
  const lote = { cliente:[{id:'cN',nome:'Novo',rotaId:'rA',version:0,updatedAt:new Date().toISOString()}] };
  S.push('u1','lote-1',lote);
  const r2 = S.push('u1','lote-1',lote);
  ck('lote repetido => jaProcessado', r2.jaProcessado===true);
  ck('cliente novo inserido uma vez', S.db.cliente.has('cN'));
}

// 3) PUSH de usuário com senha: allowlist remove senha, hash do servidor intacto
{
  S.push('u1','lote-senha',{ usuario:[{id:'u1',pushToken:'novo-token',senha:'HACK',tokenVersao:99}] });
  const u = S.db.usuario.get('u1');
  ck('senha do servidor preservada', u.senha==='HASH_ORIGINAL');
  ck('tokenVersao não sobrescrito pelo push', u.tokenVersao===0);
  ck('pushToken atualizado', u.pushToken==='novo-token');
}

// 4) Cobrança append-only idempotente: mesmo id duas vezes => uma cobrança, saldo correto
{
  const cob = {id:'cob1',locacaoId:'locA',usuarioId:'u1',valorLiquidoBase:'100.00',valorLiquidoFinal:'100.00',dataCobranca:new Date().toISOString(),updatedAt:new Date().toISOString()};
  S.push('u1','lote-cob1',{ cobranca:[cob] });
  S.push('u1','lote-cob1-retry',{ cobranca:[cob] }); // reenvio (mesmo id, lote diferente)
  const cobrancasLocA = [...S.db.cobranca.values()].filter(c=>c.locacaoId==='locA');
  ck('cobrança duplicada ignorada (append-only)', cobrancasLocA.length===1);
}

// 5) Saldo derivado do histórico do campo (pagamento parcial); servidor NUNCA confia em saldo do cliente
{
  S.push('u1','lote-pag1',{ pagamento:[{id:'pag1',alvo:'COBRANCA',cobrancaId:'cob1',usuarioId:'u1',valor:'80.00',formaPagamento:'DINHEIRO',dataPagamento:new Date().toISOString(),updatedAt:new Date().toISOString()}] });
  ck('saldo derivado = 100 - 80 = 20', S.db.locacao.get('locA').saldoDevedorAtual===20);
  // tenta empurrar locacao com saldo mentiroso — allowlist nem deixa o campo entrar
  const limpo = sanitizarPush('locacao', {id:'locA',status:'ATIVA',saldoDevedorAtual:0,version:0});
  ck('saldoDevedorAtual não está na allowlist de locacao', !('saldoDevedorAtual' in limpo));
}

// 6) Conflito versionado: dois dispositivos editam cA a partir da v0
{
  const base = {id:'cA',nome:'',rotaId:'rA',version:0,updatedAt:new Date().toISOString()};
  S.push('u1','dispX',{ cliente:[{...base,nome:'Editado por X'}] });           // v0->v1 OK
  const r = S.push('u1','dispY',{ cliente:[{...base,nome:'Editado por Y'}] });   // ainda v0 -> conflito
  ck('segundo editor gera CONFLITO', r.conflitos.some(c=>c.id==='cA'));
  ck('servidor mantém edição do primeiro (X)', S.db.cliente.get('cA').nome==='Editado por X');
  ck('conflito registrado para análise', S.db.conflito.some(c=>c.id==='cA'));
}

// 7) Tombstone: servidor marca deletado; pull incremental entrega com deletedAt
{
  const c = S.db.cliente.get('cN'); c.deletedAt=new Date().toISOString(); c.updatedAt=new Date().toISOString();
  const r = S.pull('u1', new Date(Date.now()-1000).toISOString(), false);
  const tomb = r.mudancas.cliente.find(x=>x.id==='cN');
  ck('pull entrega tombstone (deletedAt presente)', !!tomb && !!tomb.deletedAt);
}

console.log(`\nResultado: ${ok}/${n} verificações de integração passaram.`);
process.exit(ok===n?0:1);
