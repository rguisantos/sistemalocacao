import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { criarApp, limparBanco, seedBasico, login } from './utils';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * e2e dos fluxos novos (não cobertos por auth/cobrancas/sync):
 *  - finalização → relocação do MESMO produto (índice único chaveProdutoAtivo);
 *  - quitação de SaldoDevedorLocacao (parcial/total, idempotência, já quitado);
 *  - lista de cobrança (saldos pendentes do cliente).
 * Requer Postgres + Redis (docker-compose.test.yml). Roda com `npm -w @app/api run test:e2e`.
 */
describe('Fluxos novos: relocação, quitação e lista de cobrança (e2e)', () => {
  let app: INestApplication; let prisma: PrismaService;
  let tokenAdmin: string; let tokenCobrador: string; let seed: any;

  beforeAll(async () => {
    ({ app, prisma } = await criarApp());
    await limparBanco(prisma, app);
    seed = await seedBasico(app, prisma);
    tokenAdmin = await login(app, '00000000000');
    tokenCobrador = await login(app, '11111111111');
  });
  afterAll(async () => { await app.close(); });

  const srv = () => app.getHttpServer();
  const comAdmin = (r: request.Test) => r.set('Authorization', `Bearer ${tokenAdmin}`);
  const comCobrador = (r: request.Test) => r.set('Authorization', `Bearer ${tokenCobrador}`);

  // Produto isolado por teste (evita colisão no índice "1 ativa por produto").
  const novoProduto = (plaqueta: string, contador = 0) =>
    prisma.produto.create({ data: {
      plaqueta, tipoId: seed.produto.tipoId, tamanhoId: seed.produto.tamanhoId,
      condicaoId: seed.produto.condicaoId, contador,
    } });

  const criarLocacaoFixa = async (produtoId: string, clienteId: string, enderecoId: string, valorFixo: number) => {
    const r = await comAdmin(request(srv()).post('/locacoes').send({
      produtoId, clienteId, enderecoId, regra: 'VALOR_FIXO', frequencia: 'MENSAL', valorFixo,
    }));
    expect(r.status).toBe(201);
    return r.body;
  };

  // ---------------------------------------------------------------------------
  describe('Finalização → relocação do mesmo produto', () => {
    it('relocação numa chamada: finaliza a antiga, preserva o saldo e reabre no mesmo produto', async () => {
      const prod = await novoProduto('R-001', 500);
      const endB = await prisma.endereco.create({ data: { clienteId: seed.clienteB.id, logradouro: 'Rua B' } });
      const loc = await criarLocacaoFixa(prod.id, seed.clienteA.id, seed.enderecoA.id, 100);

      // cobra sem pagar => saldo 100 na locação antiga
      await comCobrador(request(srv()).post('/cobrancas').send({ locacaoId: loc.id }));

      const fim = await comAdmin(request(srv()).post(`/locacoes/${loc.id}/finalizar`).send({
        tipo: 'RELOCACAO', novaLocacao: { clienteId: seed.clienteB.id, enderecoId: endB.id },
      }));
      expect(fim.status).toBe(201);
      expect(fim.body.status).toBe('FINALIZADA');
      expect(fim.body.novaLocacaoId).toBeTruthy();

      // antiga: finalizada, produto liberado, aponta para a nova
      const antiga = await prisma.locacao.findUnique({ where: { id: loc.id } });
      expect(antiga!.status).toBe('FINALIZADA');
      expect(antiga!.chaveProdutoAtivo).toBeNull();
      expect(antiga!.relocadaParaId).toBe(fim.body.novaLocacaoId);

      // nova: ativa no MESMO produto, herda a regra/valor, contador inicial = contador atual do produto
      const prodAtual = await prisma.produto.findUnique({ where: { id: prod.id } });
      const nova = await prisma.locacao.findUnique({ where: { id: fim.body.novaLocacaoId } });
      expect(nova!.status).toBe('ATIVA');
      expect(nova!.produtoId).toBe(prod.id);
      expect(nova!.clienteId).toBe(seed.clienteB.id);
      expect(nova!.chaveProdutoAtivo).toBe(prod.id);
      expect(nova!.regra).toBe('VALOR_FIXO');
      expect(Number(nova!.valorFixo)).toBe(100);
      expect(nova!.contadorInicial).toBe(prodAtual!.contador);

      // saldo da antiga preservado como registro independente, PENDENTE
      const saldos = await prisma.saldoDevedorLocacao.findMany({ where: { locacaoId: loc.id } });
      expect(saldos.length).toBe(1);
      expect(Number(saldos[0].valorOriginal)).toBe(100);
      expect(saldos[0].status).toBe('PENDENTE');

      // exatamente UMA locação ativa no produto (índice único respeitado)
      expect(await prisma.locacao.count({ where: { produtoId: prod.id, status: 'ATIVA' } })).toBe(1);
    });

    it('produto segue com 1 ativa: nova locação direta no mesmo produto => 409', async () => {
      const prod = await prisma.produto.findFirst({ where: { plaqueta: 'R-001' } });
      const r = await comAdmin(request(srv()).post('/locacoes').send({
        produtoId: prod!.id, clienteId: seed.clienteA.id, enderecoId: seed.enderecoA.id,
        regra: 'VALOR_FIXO', frequencia: 'MENSAL', valorFixo: 50,
      }));
      expect(r.status).toBe(409);
    });

    it('finalização para depósito libera o produto e permite nova locação', async () => {
      const prod = await novoProduto('R-002', 0);
      const loc = await criarLocacaoFixa(prod.id, seed.clienteA.id, seed.enderecoA.id, 80);
      const dep = await prisma.deposito.create({ data: { nome: 'Dep R-002' } });

      const fim = await comAdmin(request(srv()).post(`/locacoes/${loc.id}/finalizar`).send({ tipo: 'DEPOSITO', depositoId: dep.id }));
      expect(fim.status).toBe(201);
      expect(fim.body.novaLocacaoId).toBeNull();

      const nova = await comAdmin(request(srv()).post('/locacoes').send({
        produtoId: prod.id, clienteId: seed.clienteA.id, enderecoId: seed.enderecoA.id,
        regra: 'VALOR_FIXO', frequencia: 'MENSAL', valorFixo: 80,
      }));
      expect(nova.status).toBe(201);
    });

    it('relocação sem dados da nova locação => 400', async () => {
      const prod = await novoProduto('R-003', 0);
      const loc = await criarLocacaoFixa(prod.id, seed.clienteA.id, seed.enderecoA.id, 70);
      const r = await comAdmin(request(srv()).post(`/locacoes/${loc.id}/finalizar`).send({ tipo: 'RELOCACAO' }));
      expect(r.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Quitação de saldo devedor', () => {
    // Cria uma locação fixa, cobra sem pagar e finaliza p/ depósito → devolve o saldo gerado.
    const criarSaldo = async (valor: number, plaqueta: string) => {
      const prod = await novoProduto(plaqueta, 0);
      const loc = await criarLocacaoFixa(prod.id, seed.clienteA.id, seed.enderecoA.id, valor);
      await comCobrador(request(srv()).post('/cobrancas').send({ locacaoId: loc.id }));
      const dep = await prisma.deposito.create({ data: { nome: `Dep ${plaqueta}` } });
      await comAdmin(request(srv()).post(`/locacoes/${loc.id}/finalizar`).send({ tipo: 'DEPOSITO', depositoId: dep.id }));
      const saldo = await prisma.saldoDevedorLocacao.findFirst({ where: { locacaoId: loc.id } });
      expect(saldo).toBeTruthy();
      return saldo!;
    };

    it('pagamento parcial mantém PENDENTE; pagamento do restante quita', async () => {
      const saldo = await criarSaldo(100, 'Q-001');

      const p1 = await comCobrador(request(srv()).post(`/saldo-devedor/${saldo.id}/pagar`).send({ valor: 30, formaPagamento: 'DINHEIRO' }));
      expect(p1.status).toBe(201);
      expect(Number(p1.body.saldo.valorRestante)).toBe(70);
      expect(p1.body.saldo.status).toBe('PENDENTE');

      const p2 = await comCobrador(request(srv()).post(`/saldo-devedor/${saldo.id}/pagar`).send({ valor: 70, formaPagamento: 'PIX_MANUAL' }));
      expect(p2.status).toBe(201);
      expect(Number(p2.body.saldo.valorRestante)).toBe(0);
      expect(p2.body.saldo.status).toBe('QUITADO');
    });

    it('pagar saldo já quitado => 400', async () => {
      const saldo = await criarSaldo(50, 'Q-002');
      await comCobrador(request(srv()).post(`/saldo-devedor/${saldo.id}/pagar`).send({ valor: 50, formaPagamento: 'DINHEIRO' }));
      const r = await comCobrador(request(srv()).post(`/saldo-devedor/${saldo.id}/pagar`).send({ valor: 1, formaPagamento: 'DINHEIRO' }));
      expect(r.status).toBe(400);
    });

    it('pagamento é idempotente por pagamentoId (não desconta duas vezes)', async () => {
      const saldo = await criarSaldo(100, 'Q-003');
      const pagamentoId = randomUUID();
      const body = { pagamentoId, valor: 40, formaPagamento: 'DINHEIRO' };

      const r1 = await comCobrador(request(srv()).post(`/saldo-devedor/${saldo.id}/pagar`).send(body));
      expect(r1.status).toBe(201);
      const r2 = await comCobrador(request(srv()).post(`/saldo-devedor/${saldo.id}/pagar`).send(body));
      expect(r2.body.idempotente).toBe(true);

      expect(await prisma.pagamento.count({ where: { id: pagamentoId } })).toBe(1);
      const s = await prisma.saldoDevedorLocacao.findUnique({ where: { id: saldo.id } });
      expect(Number(s!.valorRestante)).toBe(60);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Lista de cobrança (saldos pendentes do cliente)', () => {
    it('GET /saldo-devedor lista pendentes (>0) e some quando quita', async () => {
      // cliente isolado p/ não somar com saldos de outros testes
      const cli = await prisma.cliente.create({ data: { tipo: 'PF', nome: 'Carlos', cpfCnpj: '44444444444', rotaId: seed.rotaA.id } });
      const end = await prisma.endereco.create({ data: { clienteId: cli.id, logradouro: 'Rua C' } });
      const prod = await novoProduto('L-001', 0);
      const loc = await criarLocacaoFixa(prod.id, cli.id, end.id, 120);
      await comCobrador(request(srv()).post('/cobrancas').send({ locacaoId: loc.id }));
      const dep = await prisma.deposito.create({ data: { nome: 'Dep L-001' } });
      await comAdmin(request(srv()).post(`/locacoes/${loc.id}/finalizar`).send({ tipo: 'DEPOSITO', depositoId: dep.id }));

      const r1 = await comCobrador(request(srv()).get(`/saldo-devedor?clienteId=${cli.id}`));
      expect(r1.status).toBe(200);
      expect(r1.body.length).toBe(1);
      expect(Number(r1.body[0].valorRestante)).toBe(120);

      await comCobrador(request(srv()).post(`/saldo-devedor/${r1.body[0].id}/pagar`).send({ valor: 120, formaPagamento: 'DINHEIRO' }));
      const r2 = await comCobrador(request(srv()).get(`/saldo-devedor?clienteId=${cli.id}`));
      expect(r2.status).toBe(200);
      expect(r2.body.length).toBe(0);
    });
  });
});
