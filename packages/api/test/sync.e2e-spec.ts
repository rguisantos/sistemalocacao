import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { criarApp, limparBanco, seedBasico, login } from './utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Sync (e2e)', () => {
  let app: INestApplication; let prisma: PrismaService; let token: string; let seed: any;
  beforeAll(async () => {
    ({ app, prisma } = await criarApp()); await limparBanco(prisma, app); seed = await seedBasico(app, prisma);
    token = await login(app, '11111111111');
  });
  afterAll(async () => { await app.close(); });
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  it('pull escopa por rota e nunca expõe senha', async () => {
    const res = await auth(request(app.getHttpServer()).post('/sync/pull').send({ lastPulledAt: null, fullSync: true }));
    expect(res.status).toBe(200);
    const idsCliente = res.body.mudancas.cliente.map((c: any) => c.id);
    expect(idsCliente).toContain(seed.clienteA.id);     // rota do cobrador
    expect(idsCliente).not.toContain(seed.clienteB.id); // rota alheia
    expect(res.body.mudancas.usuario[0].senha).toBeUndefined();
    expect(res.body.serverTimestamp).toBeDefined();
  });

  it('push é idempotente por lote', async () => {
    const idem = randomUUID();
    const id = randomUUID();
    const lote = { mudancas: { endereco: [{ id, clienteId: seed.clienteA.id, logradouro: 'Rua Nova', updatedAt: new Date().toISOString() }] }, idempotencyKey: idem };
    await auth(request(app.getHttpServer()).post('/sync/push').send(lote)).expect(200);
    const r2 = await auth(request(app.getHttpServer()).post('/sync/push').send(lote)).expect(200);
    expect(r2.body.jaProcessado).toBe(true);
    const count = await prisma.endereco.count({ where: { id } });
    expect(count).toBe(1);
  });

  it('push de usuario com senha não sobrescreve o hash do servidor', async () => {
    const antes = await prisma.usuario.findUnique({ where: { id: seed.cobrador.id } });
    await auth(request(app.getHttpServer()).post('/sync/push').send({
      idempotencyKey: randomUUID(),
      mudancas: { usuario: [{ id: seed.cobrador.id, pushToken: 'tok-novo', senha: 'HACK', tokenVersao: 99 }] },
    })).expect(200);
    const depois = await prisma.usuario.findUnique({ where: { id: seed.cobrador.id } });
    expect(depois!.senha).toBe(antes!.senha);   // hash intacto
    expect(depois!.tokenVersao).toBe(antes!.tokenVersao);
    expect(depois!.pushToken).toBe('tok-novo');
  });

  it('conflito versionado: segundo editor perde e gera ConflitoSincronizacao', async () => {
    const cli = await prisma.cliente.findUnique({ where: { id: seed.clienteA.id } });
    const base = { id: cli!.id, version: cli!.version, rotaId: cli!.rotaId, updatedAt: new Date().toISOString() };
    await auth(request(app.getHttpServer()).post('/sync/push').send({ idempotencyKey: randomUUID(), mudancas: { cliente: [{ ...base, nome: 'Editado X' }] } })).expect(200);
    const r = await auth(request(app.getHttpServer()).post('/sync/push').send({ idempotencyKey: randomUUID(), mudancas: { cliente: [{ ...base, nome: 'Editado Y' }] } }));
    expect(r.body.conflitos.length).toBeGreaterThan(0);
    const atual = await prisma.cliente.findUnique({ where: { id: cli!.id } });
    expect(atual!.nome).toBe('Editado X');
    expect(await prisma.conflitoSincronizacao.count({ where: { entidadeId: cli!.id } })).toBeGreaterThan(0);
  });
});
