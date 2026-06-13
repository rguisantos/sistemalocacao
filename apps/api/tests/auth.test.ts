// apps/api/tests/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma } from '@locacoes/database';
import { app, limparBanco, montarCenarioBase, auth, type ContextoTeste } from './helpers';

let ctx: ContextoTeste;

beforeEach(async () => {
  await limparBanco();
  ctx = await montarCenarioBase();
});

describe('POST /api/auth/login', () => {
  it('rejeita senha incorreta com 401 e audita a falha', async () => {
    const resp = await request(app)
      .post('/api/auth/login')
      .send({ cpf: '12345678901', senha: 'errada' });
    expect(resp.status).toBe(401);

    const log = await prisma.logAuditoria.findFirst({ where: { acao: 'login_falha' } });
    expect(log).not.toBeNull();
    // CPF deve estar mascarado no log
    expect(JSON.stringify(log!.dadosNovos)).not.toContain('12345678901');
  });

  it('nunca retorna senhaHash no payload', async () => {
    const resp = await request(app)
      .post('/api/auth/login')
      .send({ cpf: '12345678901', senha: 'senha123' });
    expect(resp.status).toBe(200);
    expect(JSON.stringify(resp.body)).not.toContain('senhaHash');
    expect(resp.body.usuario.permissoes.length).toBeGreaterThan(0);
  });

  it('rejeita usuário desativado', async () => {
    await prisma.usuario.update({ where: { id: ctx.usuarioId }, data: { ativo: false } });
    const resp = await request(app)
      .post('/api/auth/login')
      .send({ cpf: '12345678901', senha: 'senha123' });
    expect(resp.status).toBe(401);
  });
});

describe('POST /api/auth/refresh — rotação e reuso', () => {
  it('rotaciona: o novo refresh funciona', async () => {
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: ctx.refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(ctx.refreshToken);

    const r2 = await request(app).post('/api/auth/refresh').send({ refreshToken: r1.body.refreshToken });
    expect(r2.status).toBe(200);
  });

  it('reuso dentro da janela de 60s é tolerado (multi-tab)', async () => {
    await request(app).post('/api/auth/refresh').send({ refreshToken: ctx.refreshToken });
    // reuso imediato do token antigo: corrida benigna
    const reuso = await request(app).post('/api/auth/refresh').send({ refreshToken: ctx.refreshToken });
    expect(reuso.status).toBe(200);
  });

  it('reuso FORA da janela revoga todas as sessões e audita', async () => {
    await request(app).post('/api/auth/refresh').send({ refreshToken: ctx.refreshToken });
    // envelhece a rotação para fora do grace de 60s
    await prisma.refreshToken.updateMany({
      where: { usuarioId: ctx.usuarioId, rotatedAt: { not: null } },
      data: { rotatedAt: new Date(Date.now() - 120_000) },
    });

    const reuso = await request(app).post('/api/auth/refresh').send({ refreshToken: ctx.refreshToken });
    expect(reuso.status).toBe(401);

    const ativos = await prisma.refreshToken.count({
      where: { usuarioId: ctx.usuarioId, revokedAt: null },
    });
    expect(ativos).toBe(0); // tudo revogado

    const log = await prisma.logAuditoria.findFirst({ where: { acao: 'refresh_token_reuso_detectado' } });
    expect(log).not.toBeNull();
  });

  it('troca de senha revoga as sessões existentes', async () => {
    const r = await request(app)
      .put(`/api/usuarios/${ctx.usuarioId}`)
      .set(auth(ctx.token))
      .send({ senha: 'novaSenha123' });
    expect(r.status).toBe(200);

    const refresh = await request(app).post('/api/auth/refresh').send({ refreshToken: ctx.refreshToken });
    expect(refresh.status).toBe(401);
  });
});

describe('autorização', () => {
  it('bloqueia rota protegida sem token', async () => {
    const resp = await request(app).get('/api/clientes');
    expect(resp.status).toBe(401);
  });

  it('bloqueia permissão insuficiente com 403', async () => {
    // remove gerenciar_usuarios e tenta listar usuários
    const perm = await prisma.permissao.findUnique({ where: { chave: 'gerenciar_usuarios' } });
    await prisma.usuarioPermissao.delete({
      where: { usuarioId_permissaoId: { usuarioId: ctx.usuarioId, permissaoId: perm!.id } },
    });
    // novo login para o JWT refletir as permissões atuais
    const login = await request(app).post('/api/auth/login').send({ cpf: '12345678901', senha: 'senha123' });
    const resp = await request(app).get('/api/usuarios').set(auth(login.body.accessToken));
    expect(resp.status).toBe(403);
  });
});
