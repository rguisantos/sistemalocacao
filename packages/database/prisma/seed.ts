// packages/database/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISSOES = [
  // Administração
  { chave: 'gerenciar_usuarios', descricao: 'CRUD de usuários e atribuição de permissões', grupo: 'administracao' },
  { chave: 'visualizar_logs_auditoria', descricao: 'Visualizar logs de auditoria', grupo: 'administracao' },
  { chave: 'configuracoes_sistema', descricao: 'Backups e parâmetros do sistema', grupo: 'administracao' },
  { chave: 'gerenciar_integracoes_pagamento', descricao: 'Configurar integrações de pagamento', grupo: 'administracao' },
  // Cadastros
  { chave: 'gerenciar_produtos', descricao: 'CRUD de produtos', grupo: 'cadastros' },
  { chave: 'gerenciar_tipos_produto', descricao: 'CRUD de tipos de produto', grupo: 'cadastros' },
  { chave: 'gerenciar_tamanhos', descricao: 'CRUD de tamanhos', grupo: 'cadastros' },
  { chave: 'gerenciar_condicoes', descricao: 'CRUD de condições', grupo: 'cadastros' },
  { chave: 'gerenciar_depositos', descricao: 'CRUD de depósitos', grupo: 'cadastros' },
  { chave: 'gerenciar_rotas', descricao: 'CRUD de rotas', grupo: 'cadastros' },
  { chave: 'gerenciar_clientes', descricao: 'CRUD de clientes', grupo: 'cadastros' },
  { chave: 'transferir_cliente_rota', descricao: 'Transferir cliente entre rotas', grupo: 'cadastros' },
  // Operações
  { chave: 'criar_editar_locacao', descricao: 'Criar e editar locações', grupo: 'operacoes' },
  { chave: 'finalizar_locacao_deposito', descricao: 'Finalizar locação para depósito', grupo: 'operacoes' },
  { chave: 'finalizar_locacao_relocacao', descricao: 'Finalizar locação por relocação', grupo: 'operacoes' },
  { chave: 'editar_regras_locacao', descricao: 'Editar regras de cobrança de locação', grupo: 'operacoes' },
  { chave: 'alterar_contador_locacao', descricao: 'Alterar contador de locação', grupo: 'operacoes' },
  { chave: 'registrar_cobranca', descricao: 'Registrar cobranças', grupo: 'operacoes' },
  { chave: 'marcar_troca_pano', descricao: 'Marcar troca de pano', grupo: 'operacoes' },
  { chave: 'visualizar_clientes_todas_rotas', descricao: 'Ver clientes de todas as rotas', grupo: 'operacoes' },
  { chave: 'visualizar_produtos_deposito', descricao: 'Ver produtos em depósito', grupo: 'operacoes' },
  // Relatórios
  { chave: 'visualizar_relatorios', descricao: 'Visualizar relatórios', grupo: 'relatorios' },
  { chave: 'exportar_relatorios_pdf', descricao: 'Exportar relatórios em PDF', grupo: 'relatorios' },
  { chave: 'exportar_relatorios_excel', descricao: 'Exportar relatórios em Excel', grupo: 'relatorios' },
  { chave: 'visualizar_relatorios_outras_rotas', descricao: 'Relatórios de outras rotas', grupo: 'relatorios' },
  // Dispositivos
  { chave: 'usar_impressao_termica', descricao: 'Usar impressão térmica Bluetooth', grupo: 'dispositivos' },
];

async function main() {
  console.log('🌱 Iniciando seed...');

  // Permissões
  for (const p of PERMISSOES) {
    await prisma.permissao.upsert({
      where: { chave: p.chave },
      update: { descricao: p.descricao, grupo: p.grupo },
      create: p,
    });
  }
  console.log(`✅ ${PERMISSOES.length} permissões`);

  // Admin
  const senhaHash = await bcrypt.hash(process.env.ADMIN_SENHA ?? 'admin123', 12);
  const admin = await prisma.usuario.upsert({
    where: { cpf: '00000000000' },
    update: {},
    create: { nome: 'Administrador', cpf: '00000000000', senhaHash, ativo: true },
  });

  const todasPermissoes = await prisma.permissao.findMany();
  for (const p of todasPermissoes) {
    await prisma.usuarioPermissao.upsert({
      where: { usuarioId_permissaoId: { usuarioId: admin.id, permissaoId: p.id } },
      update: {},
      create: { usuarioId: admin.id, permissaoId: p.id },
    });
  }
  console.log('✅ Admin criado (CPF: 00000000000 / senha: admin123 — ALTERE EM PRODUÇÃO)');

  // Cadastros auxiliares
  for (const nome of ['Mesa de Sinuca', 'Jukebox', 'Fliperama']) {
    await prisma.tipoProduto.upsert({ where: { nome }, update: {}, create: { nome } });
  }
  for (const descricao of ['1,80m', '2,00m', '2,20m', '2,40m', 'Grande']) {
    await prisma.tamanho.upsert({ where: { descricao }, update: {}, create: { descricao } });
  }
  for (const descricao of ['Ótimo', 'Bom', 'Regular', 'Ruim']) {
    await prisma.condicao.upsert({ where: { descricao }, update: {}, create: { descricao } });
  }
  console.log('✅ Cadastros auxiliares');
  console.log('🌱 Seed concluído!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
