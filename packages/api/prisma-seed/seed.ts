/**
 * Seed inicial: popula o catálogo de Permissao e cria um usuário administrador.
 * Rodar: npx ts-node prisma-seed/seed.ts  (com DATABASE_URL definido)
 *
 * Variáveis opcionais: ADMIN_CPF, ADMIN_SENHA, ADMIN_NOME.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { PERMISSOES, PAPEIS } from './permissoes';

const prisma = new PrismaClient();

async function main() {
  // 1) Permissões (idempotente por chave única)
  for (const p of PERMISSOES) {
    await prisma.permissao.upsert({ where: { chave: p.chave }, update: { descricao: p.descricao }, create: p });
  }

  // 2) Admin inicial
  const cpf = process.env.ADMIN_CPF ?? '00000000000';
  const existe = await prisma.usuario.findUnique({ where: { cpf } });
  if (!existe) {
    const senha = await argon2.hash(process.env.ADMIN_SENHA ?? 'admin1234', { type: argon2.argon2id });
    const todasPermissoes = await prisma.permissao.findMany({
      where: { chave: { in: PAPEIS.Administrador } }, select: { id: true },
    });
    await prisma.usuario.create({
      data: {
        nome: process.env.ADMIN_NOME ?? 'Administrador',
        cpf, senha, ativo: true,
        permissoes: { create: todasPermissoes.map((p) => ({ permissaoId: p.id })) },
      },
    });
    console.log(`Admin criado (CPF ${cpf}).`);
  } else {
    // Admin já existe — sincroniza permissões que possam ter sido adicionadas
    const todasPermissoes = await prisma.permissao.findMany({
      where: { chave: { in: PAPEIS.Administrador } }, select: { id: true },
    });
    const existentes = await prisma.usuarioPermissao.findMany({
      where: { usuarioId: existe.id }, select: { permissaoId: true },
    });
    const idsExistentes = new Set(existentes.map((e) => e.permissaoId));
    const novas = todasPermissoes.filter((p) => !idsExistentes.has(p.id));
    if (novas.length > 0) {
      await prisma.usuarioPermissao.createMany({
        data: novas.map((p) => ({ usuarioId: existe.id, permissaoId: p.id })),
      });
      console.log(`+${novas.length} permissões adicionadas ao admin.`);
    } else {
      console.log('Admin já existe com todas as permissões — pulando.');
    }
  }
  console.log(`${PERMISSOES.length} permissões garantidas.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
