// Infra compartilhada dos testes de integração.
//
// REQUISITOS:
//   - Banco de teste DEDICADO (os testes truncam as tabelas!)
//     export DATABASE_URL="postgresql://locacoes:locacoes@localhost:5432/locacoes_test"
//   - Secrets de teste:
//     export JWT_ACCESS_SECRET="teste-teste-teste-teste-teste-teste"
//     export JWT_REFRESH_SECRET="teste-teste-teste-teste-teste-teste"
//   - Schema aplicado: npx prisma db push (com a DATABASE_URL acima)
//
// Rodar:  cd apps/api && npm test
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { prisma, Prisma } from '@locacoes/database';
import { criarApp } from '../src/app';

export const app = criarApp();
export const D = (v: string | number) => new Prisma.Decimal(v);

/** Trunca todas as tabelas (ordem segura via CASCADE) */
export async function limparBanco() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      conflitos_sync, logs_auditoria, pagamentos_saldo, saldos_devedores_locacao,
      cobrancas, locacoes, enderecos, clientes, produtos,
      condicoes, tamanhos, tipos_produto, depositos,
      usuario_rotas, rotas, usuario_permissoes, permissoes,
      refresh_tokens, usuarios
    RESTART IDENTITY CASCADE
  `);
}

export interface ContextoTeste {
  usuarioId: string;
  token: string;
  refreshToken: string;
  rotaId: string;
  clienteId: string;
  enderecoId: string;
  produtoId: string;
}

/** Cria usuário admin-like com todas as permissões + cadastros básicos e retorna tokens */
export async function montarCenarioBase(): Promise<ContextoTeste> {
  const chaves = [
    'gerenciar_usuarios', 'gerenciar_clientes', 'criar_editar_locacao',
    'registrar_cobranca', 'visualizar_relatorios', 'visualizar_logs_auditoria',
    'visualizar_clientes_todas_rotas', 'finalizar_locacao_deposito',
    'finalizar_locacao_relocacao', 'marcar_troca_pano', 'gerenciar_produtos',
  ];
  await prisma.permissao.createMany({
    data: chaves.map((chave) => ({ chave, descricao: chave })),
    skipDuplicates: true,
  });

  const senhaHash = await bcrypt.hash('senha123', 4);
  const usuario = await prisma.usuario.create({
    data: { nome: 'Teste', cpf: '12345678901', senhaHash, version: BigInt(Date.now()) },
  });
  const permissoes = await prisma.permissao.findMany();
  await prisma.usuarioPermissao.createMany({
    data: permissoes.map((p) => ({ usuarioId: usuario.id, permissaoId: p.id })),
  });

  const rota = await prisma.rota.create({ data: { nome: 'Rota Teste', version: BigInt(Date.now()) } });
  await prisma.usuarioRota.create({ data: { usuarioId: usuario.id, rotaId: rota.id } });

  const tipo = await prisma.tipoProduto.create({ data: { nome: 'Mesa' } });
  const produto = await prisma.produto.create({
    data: { plaqueta: 'T-001', tipoProdutoId: tipo.id, contador: 0, version: BigInt(Date.now()) },
  });
  const cliente = await prisma.cliente.create({
    data: { nome: 'Cliente Teste', rotaId: rota.id, telefones: [], version: BigInt(Date.now()) },
  });
  const endereco = await prisma.endereco.create({
    data: {
      clienteId: cliente.id, logradouro: 'Rua A', numero: '1', bairro: 'Centro',
      cidade: 'SP', estado: 'SP', cep: '01000000', version: BigInt(Date.now()),
    },
  });

  const resp = await request(app)
    .post('/api/auth/login')
    .send({ cpf: '12345678901', senha: 'senha123' });
  if (resp.status !== 200) throw new Error(`Login de teste falhou: ${JSON.stringify(resp.body)}`);

  return {
    usuarioId: usuario.id,
    token: resp.body.accessToken,
    refreshToken: resp.body.refreshToken,
    rotaId: rota.id,
    clienteId: cliente.id,
    enderecoId: endereco.id,
    produtoId: produto.id,
  };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
