// apps/api/tests/sync.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { prisma } from '@locacoes/database';
import { app, limparBanco, montarCenarioBase, auth, type ContextoTeste } from './helpers';

let ctx: ContextoTeste;
const uuid = () => crypto.randomUUID();

beforeEach(async () => {
  await limparBanco();
  ctx = await montarCenarioBase();
});

function push(registros: unknown[]) {
  return request(app)
    .post('/api/sync/push')
    .set(auth(ctx.token))
    .send({ deviceId: 'device-teste', registros });
}

describe('push — segurança e idempotência', () => {
  it('campos fora da allowlist são descartados (senha nunca entra)', async () => {
    const id = uuid();
    const resp = await push([{
      id, entidade: 'clientes', operacao: 'create', version: Date.now(),
      dados: {
        nome: 'Novo Cliente', rotaId: ctx.rotaId, telefones: [],
        senhaHash: 'hack', isDeleted: true, saldoAtual: '999', // tentativas maliciosas
      },
    }]);
    expect(resp.body.resultados[0].status).toBe('applied');

    const cliente = await prisma.cliente.findUnique({ where: { id } });
    expect(cliente!.nome).toBe('Novo Cliente');
    expect(cliente!.isDeleted).toBe(false); // ignorado
  });

  it('entidade não sincronizável é rejeitada', async () => {
    const resp = await push([{
      id: uuid(), entidade: 'usuarios', operacao: 'update', version: Date.now(),
      dados: { senhaHash: 'hack' },
    }]);
    expect(resp.body.resultados[0].status).toBe('error');
  });

  it('cobrança duplicada (retry) é idempotente', async () => {
    // locação percentual
    const loc = await request(app).post('/api/locacoes').set(auth(ctx.token)).send({
      produtoId: ctx.produtoId, clienteId: ctx.clienteId, enderecoId: ctx.enderecoId,
      regra: 'PERCENTUAL_A_RECEBER', valorPartida: '2.00', percentual: '0.5', contadorInicial: 1000,
    });

    const registro = {
      id: uuid(), entidade: 'cobrancas', operacao: 'create', version: Date.now(),
      dados: {
        locacaoId: loc.body.id, contadorAtual: 1100,
        valorRecebidoPago: '100.00', formaPagamento: 'DINHEIRO',
      },
    };

    const r1 = await push([registro]);
    const r2 = await push([registro]); // retry idêntico
    expect(r1.body.resultados[0].status).toBe('applied');
    expect(r2.body.resultados[0].status).toBe('applied');

    expect(await prisma.cobranca.count()).toBe(1); // não duplicou
    const locacao = await prisma.locacao.findUnique({ where: { id: loc.body.id } });
    expect(locacao!.saldoAtual.toFixed(2)).toBe('0.00'); // saldo aplicado uma vez
  });
});

describe('push — cascata de conflitos', () => {
  it('fast-forward: baseVersion igual à do servidor aplica direto', async () => {
    const servidor = await prisma.cliente.findUnique({ where: { id: ctx.clienteId } });
    const resp = await push([{
      id: ctx.clienteId, entidade: 'clientes', operacao: 'update',
      version: Date.now() - 999_999, // timestamp "antigo" — irrelevante com baseVersion
      baseVersion: Number(servidor!.version),
      dados: { nome: 'Nome Editado Offline', rotaId: ctx.rotaId, telefones: [] },
    }]);
    expect(resp.body.resultados[0].status).toBe('applied');

    const depois = await prisma.cliente.findUnique({ where: { id: ctx.clienteId } });
    expect(depois!.nome).toBe('Nome Editado Offline');
    expect(await prisma.conflitSync.count()).toBe(0);
  });

  it('auto-merge: divergência só em campo seguro mescla e registra resolvido', async () => {
    // servidor avança a versão (alguém editou no painel)
    await prisma.cliente.update({
      where: { id: ctx.clienteId },
      data: { nome: 'Nome do Painel', version: BigInt(Date.now() + 1000) },
    });

    const resp = await push([{
      id: ctx.clienteId, entidade: 'clientes', operacao: 'update',
      version: Date.now(), baseVersion: 1, // base defasada → divergência real
      dados: {
        nome: 'Nome do Painel',               // igual ao servidor
        observacoes: 'Anotação feita em campo', // só campo mesclável difere
        rotaId: ctx.rotaId, telefones: [],
      },
    }]);
    expect(resp.body.resultados[0].status).toBe('merged');

    const cliente = await prisma.cliente.findUnique({ where: { id: ctx.clienteId } });
    expect(cliente!.nome).toBe('Nome do Painel');          // preservado
    expect(cliente!.observacoes).toBe('Anotação feita em campo'); // mesclado

    const conflito = await prisma.conflitSync.findFirst();
    expect(conflito!.resolvido).toBe(true);
    expect(conflito!.resolucao).toBe('auto_merge');
  });

  it('campo crítico divergente vai para a fila manual e resolução aplica_mobile funciona', async () => {
    await prisma.cliente.update({
      where: { id: ctx.clienteId },
      data: { nome: 'Nome do Painel', version: BigInt(Date.now() + 1000) },
    });

    const resp = await push([{
      id: ctx.clienteId, entidade: 'clientes', operacao: 'update',
      version: Date.now(), baseVersion: 1,
      dados: { nome: 'Nome do Campo', rotaId: ctx.rotaId, telefones: [] }, // nome é crítico
    }]);
    expect(resp.body.resultados[0].status).toBe('conflict');

    const conflito = await prisma.conflitSync.findFirst({ where: { resolvido: false } });
    expect(conflito).not.toBeNull();
    expect(conflito!.camposConflitantes).toContain('nome');

    // resolução manual: aplicar versão do aparelho
    const res = await request(app)
      .post(`/api/conflitos/${conflito!.id}/resolver`)
      .set(auth(ctx.token))
      .send({ resolucao: 'aplicar_mobile' });
    expect(res.status).toBe(200);

    const cliente = await prisma.cliente.findUnique({ where: { id: ctx.clienteId } });
    expect(cliente!.nome).toBe('Nome do Campo');
  });
});

describe('pull — filtragem por rota', () => {
  it('usuário sem todas_rotas só recebe clientes das suas rotas', async () => {
    const outraRota = await prisma.rota.create({ data: { nome: 'Rota Alheia', version: BigInt(Date.now()) } });
    await prisma.cliente.create({
      data: { nome: 'Cliente Alheio', rotaId: outraRota.id, telefones: [], version: BigInt(Date.now()) },
    });

    // remove visualizar_clientes_todas_rotas e reloga
    const perm = await prisma.permissao.findUnique({ where: { chave: 'visualizar_clientes_todas_rotas' } });
    await prisma.usuarioPermissao.delete({
      where: { usuarioId_permissaoId: { usuarioId: ctx.usuarioId, permissaoId: perm!.id } },
    });
    const login = await request(app).post('/api/auth/login').send({ cpf: '12345678901', senha: 'senha123' });

    const resp = await request(app)
      .post('/api/sync/pull')
      .set(auth(login.body.accessToken))
      .send({ lastSyncTimestamp: 0 });

    const nomes = resp.body.entidades.clientes.map((c: { nome: string }) => c.nome);
    expect(nomes).toContain('Cliente Teste');
    expect(nomes).not.toContain('Cliente Alheio');
  });
});
