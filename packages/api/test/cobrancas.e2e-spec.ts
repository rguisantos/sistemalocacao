import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { criarApp, limparBanco, seedBasico, login } from './utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Cobranças (e2e)', () => {
  let app: INestApplication; let prisma: PrismaService;
  let tokenCobrador: string; let tokenAdmin: string; let seed: any;

  beforeAll(async () => {
    ({ app, prisma } = await criarApp()); await limparBanco(prisma, app); seed = await seedBasico(app, prisma);
    tokenCobrador = await login(app, '11111111111');
    tokenAdmin = await login(app, '00000000000');
  });
  afterAll(async () => { await app.close(); });

  const comAdmin = (r: request.Test) => r.set('Authorization', `Bearer ${tokenAdmin}`);
  const comCobrador = (r: request.Test) => r.set('Authorization', `Bearer ${tokenCobrador}`);

  it('locação percentual + cobrança calcula valor e deriva saldo', async () => {
    const loc = await comAdmin(request(app.getHttpServer()).post('/locacoes').send({
      produtoId: seed.produto.id, clienteId: seed.clienteA.id, enderecoId: seed.enderecoA.id,
      regra: 'PERCENTUAL_A_RECEBER', valorPartida: 1, percentual: 30, contadorInicial: 1000,
    }));
    expect(loc.status).toBe(201);

    // 1150-1000 = 150 partidas * 1.00 = 150,00 ; 30% = 45,00 ; paga 40 => saldo 5
    const res = await comCobrador(request(app.getHttpServer()).post('/cobrancas').send({
      locacaoId: loc.body.id, contadorAtual: 1150,
      pagamento: { valor: 40, formaPagamento: 'DINHEIRO' },
    }));
    expect(res.status).toBe(201);
    expect(Number(res.body.cobranca.valorLiquidoFinal)).toBe(45);
    expect(Number(res.body.saldoAtualizado)).toBe(5);
    // contador do produto foi atualizado
    const prod = await prisma.produto.findUnique({ where: { id: seed.produto.id } });
    expect(prod!.contador).toBe(1150);
  });

  it('uma locação ativa por produto: segunda criação => 409', async () => {
    const r = await comAdmin(request(app.getHttpServer()).post('/locacoes').send({
      produtoId: seed.produto.id, clienteId: seed.clienteA.id, enderecoId: seed.enderecoA.id,
      regra: 'VALOR_FIXO', frequencia: 'MENSAL', valorFixo: 100,
    }));
    expect(r.status).toBe(409);
  });

  it('cobrança é idempotente por UUID do cliente (não duplica)', async () => {
    // produto e locação novos para isolar do teste anterior
    const prod = await prisma.produto.create({ data: { plaqueta: 'P-002', tipoId: seed.produto.tipoId, tamanhoId: seed.produto.tamanhoId, condicaoId: seed.produto.condicaoId, contador: 0 } });
    const loc = await comAdmin(request(app.getHttpServer()).post('/locacoes').send({
      produtoId: prod.id, clienteId: seed.clienteA.id, enderecoId: seed.enderecoA.id,
      regra: 'VALOR_FIXO', frequencia: 'MENSAL', valorFixo: 100,
    }));
    const cobrancaId = randomUUID();
    const body = { id: cobrancaId, locacaoId: loc.body.id, pagamento: { valor: 100, formaPagamento: 'DINHEIRO' } };

    const r1 = await comCobrador(request(app.getHttpServer()).post('/cobrancas').send(body));
    expect(r1.status).toBe(201);
    const r2 = await comCobrador(request(app.getHttpServer()).post('/cobrancas').send(body));
    expect(r2.body.idempotente).toBe(true);

    const total = await prisma.cobranca.count({ where: { id: cobrancaId } });
    expect(total).toBe(1);
  });

  it('finalização para depósito gera SaldoDevedorLocacao quando há saldo', async () => {
    const prod = await prisma.produto.create({ data: { plaqueta: 'P-003', tipoId: seed.produto.tipoId, tamanhoId: seed.produto.tamanhoId, condicaoId: seed.produto.condicaoId, contador: 0 } });
    const loc = await comAdmin(request(app.getHttpServer()).post('/locacoes').send({
      produtoId: prod.id, clienteId: seed.clienteA.id, enderecoId: seed.enderecoA.id,
      regra: 'VALOR_FIXO', frequencia: 'MENSAL', valorFixo: 100,
    }));
    // cobra sem pagar => saldo 100
    await comCobrador(request(app.getHttpServer()).post('/cobrancas').send({ locacaoId: loc.body.id }));
    const deposito = await prisma.deposito.create({ data: { nome: 'Central' } });
    const fim = await comAdmin(request(app.getHttpServer()).post(`/locacoes/${loc.body.id}/finalizar`).send({ tipo: 'DEPOSITO', depositoId: deposito.id }));
    expect(fim.status).toBe(201);
    const saldos = await prisma.saldoDevedorLocacao.findMany({ where: { locacaoId: loc.body.id } });
    expect(saldos.length).toBe(1);
    expect(Number(saldos[0].valorOriginal)).toBeGreaterThan(0);
  });
});
