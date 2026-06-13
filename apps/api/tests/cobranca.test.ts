// apps/api/tests/cobranca.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma } from '@locacoes/database';
import { app, limparBanco, montarCenarioBase, auth, type ContextoTeste } from './helpers';

let ctx: ContextoTeste;

beforeEach(async () => {
  await limparBanco();
  ctx = await montarCenarioBase();
});

async function criarLocacaoPercentual() {
  const resp = await request(app)
    .post('/api/locacoes')
    .set(auth(ctx.token))
    .send({
      produtoId: ctx.produtoId,
      clienteId: ctx.clienteId,
      enderecoId: ctx.enderecoId,
      regra: 'PERCENTUAL_A_RECEBER',
      valorPartida: '2.00',
      percentual: '0.5',
      contadorInicial: 1000,
    });
  expect(resp.status).toBe(201);
  return resp.body.id as string;
}

describe('fluxo de cobrança percentual', () => {
  it('calcular (prévia) não persiste nada', async () => {
    const locacaoId = await criarLocacaoPercentual();
    const resp = await request(app)
      .post(`/api/locacoes/${locacaoId}/calcular`)
      .set(auth(ctx.token))
      .send({ contadorAtual: 1200, descontoPartidas: 20, descontoValorReceber: '30.00' });

    expect(resp.status).toBe(200);
    // (1200-1000-20) * 2.00 = 360 → 50% = 180 → -30 = 150
    expect(resp.body.valorLiquidoFinal).toBe('150.00');
    expect(await prisma.cobranca.count()).toBe(0);
  });

  it('registrar: transação atualiza cobrança + saldo + contador do produto', async () => {
    const locacaoId = await criarLocacaoPercentual();
    const resp = await request(app)
      .post(`/api/locacoes/${locacaoId}/cobrancas`)
      .set(auth(ctx.token))
      .send({
        contadorAtual: 1200,
        valorRecebidoPago: '150.00', // paga 50 a menos que os 200 devidos (sem descontos aqui)
        formaPagamento: 'DINHEIRO',
      });

    expect(resp.status).toBe(201);
    expect(resp.body.cobranca.statusPagamento).toBe('PARCIAL');

    const locacao = await prisma.locacao.findUnique({ where: { id: locacaoId } });
    expect(locacao!.saldoAtual.toFixed(2)).toBe('50.00'); // 200 - 150

    const produto = await prisma.produto.findUnique({ where: { id: ctx.produtoId } });
    expect(produto!.contador).toBe(1200);
  });

  it('próxima cobrança parte do contador anterior e soma saldo devedor', async () => {
    const locacaoId = await criarLocacaoPercentual();
    await request(app).post(`/api/locacoes/${locacaoId}/cobrancas`).set(auth(ctx.token))
      .send({ contadorAtual: 1200, valorRecebidoPago: '150.00', formaPagamento: 'DINHEIRO' });

    const previa = await request(app)
      .post(`/api/locacoes/${locacaoId}/calcular`)
      .set(auth(ctx.token))
      .send({ contadorAtual: 1300 });
    // 100 partidas * 2 = 200 → 50% = 100 → + saldo 50 = 150
    expect(previa.body.valorLiquidoFinal).toBe('150.00');
  });

  it('rejeita contador regredindo com 400', async () => {
    const locacaoId = await criarLocacaoPercentual();
    const resp = await request(app)
      .post(`/api/locacoes/${locacaoId}/cobrancas`)
      .set(auth(ctx.token))
      .send({ contadorAtual: 900, valorRecebidoPago: '0', formaPagamento: 'DINHEIRO' });
    expect(resp.status).toBe(400);
    expect(await prisma.cobranca.count()).toBe(0);
  });

  it('cliente paga a mais gera haver (saldo negativo)', async () => {
    const locacaoId = await criarLocacaoPercentual();
    await request(app).post(`/api/locacoes/${locacaoId}/cobrancas`).set(auth(ctx.token))
      .send({ contadorAtual: 1100, valorRecebidoPago: '110.00', formaPagamento: 'DINHEIRO' }); // devia 100

    const locacao = await prisma.locacao.findUnique({ where: { id: locacaoId } });
    expect(locacao!.saldoAtual.toFixed(2)).toBe('-10.00');
  });
});

describe('finalização com saldo devedor', () => {
  it('cria SaldoDevedorLocacao e o pagamento quita', async () => {
    const locacaoId = await criarLocacaoPercentual();
    await request(app).post(`/api/locacoes/${locacaoId}/cobrancas`).set(auth(ctx.token))
      .send({ contadorAtual: 1200, valorRecebidoPago: '100.00', formaPagamento: 'DINHEIRO' }); // devido 200 → resta 100

    const deposito = await prisma.deposito.create({ data: { nome: 'Dep', version: BigInt(Date.now()) } });
    const fin = await request(app)
      .post(`/api/locacoes/${locacaoId}/finalizar`)
      .set(auth(ctx.token))
      .send({ tipo: 'DEPOSITO', depositoId: deposito.id });
    expect(fin.status).toBe(200);

    const saldo = await prisma.saldoDevedorLocacao.findUnique({ where: { locacaoId } });
    expect(saldo!.valorRestante.toFixed(2)).toBe('100.00');

    // paga parcial e depois quita
    await request(app).post(`/api/locacoes/saldos/${saldo!.id}/pagamentos`).set(auth(ctx.token))
      .send({ valor: '50.00', formaPagamento: 'DINHEIRO' });
    const r2 = await request(app).post(`/api/locacoes/saldos/${saldo!.id}/pagamentos`).set(auth(ctx.token))
      .send({ valor: '50.00', formaPagamento: 'PIX_MANUAL' });
    expect(r2.status).toBe(201);

    const quitado = await prisma.saldoDevedorLocacao.findUnique({ where: { locacaoId } });
    expect(quitado!.status).toBe('QUITADO');
    expect(quitado!.valorRestante.toFixed(2)).toBe('0.00');
  });

  it('produto com locação ativa não pode ser locado de novo (409)', async () => {
    await criarLocacaoPercentual();
    const resp = await request(app)
      .post('/api/locacoes')
      .set(auth(ctx.token))
      .send({
        produtoId: ctx.produtoId, clienteId: ctx.clienteId, enderecoId: ctx.enderecoId,
        regra: 'VALOR_FIXO', frequencia: 'MENSAL', valorFixo: '300.00', contadorInicial: 0,
      });
    expect(resp.status).toBe(409);
  });
});
