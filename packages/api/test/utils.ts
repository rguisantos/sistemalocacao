import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { PERMISSOES, PAPEIS } from '../src/comum/permissoes.catalog';

export async function criarApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Limpa o banco de teste (ordem respeita FKs) e, se o app for fornecido, o Redis (rate-limit entre suites). */
export async function limparBanco(prisma: PrismaService, app?: INestApplication) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "Pagamento","Cobranca","Manutencao","SaldoDevedorLocacao","Locacao",
    "Endereco","Cliente","Produto","UsuarioPermissao","UsuarioRota","Usuario","Permissao",
    "TipoProduto","Tamanho","Condicao","Deposito","Rota","LogAuditoria","ConflitoSincronizacao"
    RESTART IDENTITY CASCADE;`);
  if (app) {
    try { await app.get(RedisService).limparTudo(); } catch { /* redis opcional no ambiente */ }
  }
}

/** Seed mínimo: permissões, admin, cobrador (rota A) e dados base. Retorna ids/tokens. */
export async function seedBasico(app: INestApplication, prisma: PrismaService) {
  for (const p of PERMISSOES) await prisma.permissao.create({ data: p });
  const perms = await prisma.permissao.findMany();
  const idDe = (chave: string) => perms.find((p) => p.chave === chave)!.id;

  const senha = await argon2.hash('senha123', { type: argon2.argon2id });
  const admin = await prisma.usuario.create({
    data: { nome: 'Admin', cpf: '00000000000', senha,
      permissoes: { create: PAPEIS.Administrador.map((c) => ({ permissaoId: idDe(c) })) } },
  });
  const rotaA = await prisma.rota.create({ data: { nome: 'Zona A' } });
  const rotaB = await prisma.rota.create({ data: { nome: 'Zona B' } });
  const cobrador = await prisma.usuario.create({
    data: { nome: 'Cobrador', cpf: '11111111111', senha,
      rotas: { create: [{ rotaId: rotaA.id }] },
      permissoes: { create: PAPEIS.AcessoControlado.map((c) => ({ permissaoId: idDe(c) })) } },
  });

  const tipo = await prisma.tipoProduto.create({ data: { nome: 'Mesa de Sinuca' } });
  const tam = await prisma.tamanho.create({ data: { descricao: '2,20m' } });
  const cond = await prisma.condicao.create({ data: { descricao: 'Bom' } });
  const produto = await prisma.produto.create({ data: { plaqueta: 'P-001', tipoId: tipo.id, tamanhoId: tam.id, condicaoId: cond.id, contador: 1000 } });
  const clienteA = await prisma.cliente.create({ data: { tipo: 'PF', nome: 'João', cpfCnpj: '22222222222', rotaId: rotaA.id } });
  const enderecoA = await prisma.endereco.create({ data: { clienteId: clienteA.id, logradouro: 'Rua 1' } });
  const clienteB = await prisma.cliente.create({ data: { tipo: 'PF', nome: 'Maria', cpfCnpj: '33333333333', rotaId: rotaB.id } });

  return { admin, cobrador, rotaA, rotaB, produto, clienteA, enderecoA, clienteB };
}

export async function login(app: INestApplication, cpf: string, senha = 'senha123') {
  const request = (await import('supertest')).default;
  const res = await request(app.getHttpServer()).post('/auth/login').send({ cpf, senha });
  return res.body.accessToken as string;
}
