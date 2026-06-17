import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { criarApp, limparBanco, seedBasico, login } from './utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication; let prisma: PrismaService;
  beforeAll(async () => { ({ app, prisma } = await criarApp()); await limparBanco(prisma, app); await seedBasico(app, prisma); });
  afterAll(async () => { await app.close(); });

  it('login válido retorna access e refresh', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ cpf: '00000000000', senha: 'senha123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.usuario.permissoes).toContain('admin.usuarios.criar');
  });

  it('senha errada => 401 com mensagem genérica', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ cpf: '00000000000', senha: 'errada' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/inválidos/i);
  });

  it('logout global revoga o token (tokenVersao)', async () => {
    const token = await login(app, '00000000000');
    await request(app.getHttpServer()).post('/auth/logout').set('Authorization', `Bearer ${token}`).expect(204);
    // token antigo agora deve ser rejeitado
    const res = await request(app.getHttpServer()).get('/usuarios').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rate limit de login dispara após o limite', async () => {
    const server = app.getHttpServer();
    let estourou = false;
    for (let i = 0; i < 15; i++) {
      const r = await request(server).post('/auth/login').send({ cpf: '00000000000', senha: 'x' });
      if (r.status === 429) { estourou = true; break; }
    }
    expect(estourou).toBe(true);
  });
});
