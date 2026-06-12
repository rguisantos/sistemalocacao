// packages/database/prisma/seed-demo.ts
// Dados de DEMONSTRAÇÃO para testar o fluxo completo.
// Rode após o seed base:  npm run db:seed && npm run db:seed:demo
// Idempotente: pode rodar mais de uma vez sem duplicar.
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const D = (v: string | number) => new Prisma.Decimal(v);
const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function main() {
  console.log('🎲 Seed de demonstração…');

  // ---- Rotas ----
  const [rotaNorte, rotaSul] = await Promise.all(
    ['Rota Norte', 'Rota Sul'].map((nome) =>
      prisma.rota.upsert({
        where: { id: `demo-rota-${nome.toLowerCase().replace(' ', '-')}` },
        update: {},
        create: { id: `demo-rota-${nome.toLowerCase().replace(' ', '-')}`, nome, version: BigInt(Date.now()) },
      })
    )
  );

  // ---- Cobrador (permissões típicas de campo) ----
  const chavesCobrador = [
    'registrar_cobranca', 'gerenciar_clientes', 'criar_editar_locacao',
    'finalizar_locacao_deposito', 'marcar_troca_pano', 'usar_impressao_termica',
    'visualizar_produtos_deposito',
  ];
  const senhaHash = await bcrypt.hash('cobrador123', 12);
  const cobrador = await prisma.usuario.upsert({
    where: { cpf: '11111111111' },
    update: {},
    create: { nome: 'Carlos Cobrador', cpf: '11111111111', senhaHash, version: BigInt(Date.now()) },
  });
  const permissoes = await prisma.permissao.findMany({ where: { chave: { in: chavesCobrador } } });
  for (const p of permissoes) {
    await prisma.usuarioPermissao.upsert({
      where: { usuarioId_permissaoId: { usuarioId: cobrador.id, permissaoId: p.id } },
      update: {}, create: { usuarioId: cobrador.id, permissaoId: p.id },
    });
  }
  await prisma.usuarioRota.upsert({
    where: { usuarioId_rotaId: { usuarioId: cobrador.id, rotaId: rotaNorte.id } },
    update: {}, create: { usuarioId: cobrador.id, rotaId: rotaNorte.id },
  });

  const admin = await prisma.usuario.findUnique({ where: { cpf: '00000000000' } });
  if (!admin) throw new Error('Rode primeiro o seed base (npm run db:seed).');

  // ---- Depósito ----
  const deposito = await prisma.deposito.upsert({
    where: { id: 'demo-deposito-central' },
    update: {},
    create: { id: 'demo-deposito-central', nome: 'Depósito Central', cidade: 'São Paulo', version: BigInt(Date.now()) },
  });

  // ---- Produtos ----
  const tipoMesa = await prisma.tipoProduto.findFirst({ where: { nome: 'Mesa de Sinuca' } });
  const tipoJuke = await prisma.tipoProduto.findFirst({ where: { nome: 'Jukebox' } });
  const tamanho = await prisma.tamanho.findFirst();
  const condicao = await prisma.condicao.findFirst();

  const plaquetas = ['MS-001', 'MS-002', 'MS-003', 'JB-001', 'MS-004'];
  const produtos = [];
  for (const plaqueta of plaquetas) {
    produtos.push(
      await prisma.produto.upsert({
        where: { plaqueta },
        update: {},
        create: {
          plaqueta,
          tipoProdutoId: plaqueta.startsWith('JB') ? tipoJuke!.id : tipoMesa!.id,
          tamanhoId: tamanho?.id, condicaoId: condicao?.id,
          contador: 0, version: BigInt(Date.now()),
        },
      })
    );
  }

  // ---- Clientes + endereços ----
  const dadosClientes = [
    { id: 'demo-cli-1', nome: 'Bar do Zé', rota: rotaNorte.id, end: ['Rua das Palmeiras', '120', 'Centro'] },
    { id: 'demo-cli-2', nome: 'Lanchonete da Maria', rota: rotaNorte.id, end: ['Av. Brasil', '45', 'Jardim América'] },
    { id: 'demo-cli-3', nome: 'Boteco do Carlão', rota: rotaSul.id, end: ['Rua XV de Novembro', '890', 'Vila Nova'] },
    { id: 'demo-cli-4', nome: 'Snooker Club Premium', rota: rotaSul.id, end: ['Av. Paulista', '1500', 'Bela Vista'] },
  ];
  const clientes: Record<string, { clienteId: string; enderecoId: string }> = {};
  for (const c of dadosClientes) {
    const cliente = await prisma.cliente.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id, nome: c.nome, rotaId: c.rota,
        telefones: [{ numero: '11987654321', tipo: 'whatsapp' }],
        version: BigInt(Date.now()),
      },
    });
    const enderecoId = `${c.id}-end`;
    await prisma.endereco.upsert({
      where: { id: enderecoId },
      update: {},
      create: {
        id: enderecoId, clienteId: cliente.id,
        logradouro: c.end[0], numero: c.end[1], bairro: c.end[2],
        cidade: 'São Paulo', estado: 'SP', cep: '01310100',
        principal: true, version: BigInt(Date.now()),
      },
    });
    clientes[c.id] = { clienteId: cliente.id, enderecoId };
  }

  // ---- Locações (uma de cada regra + uma VENCIDA) ----
  const jaTem = await prisma.locacao.findFirst({ where: { id: { startsWith: 'demo-loc-' } } });
  if (jaTem) {
    console.log('↺ Locações demo já existem; pulando.');
  } else {
    // 1) PERCENTUAL_A_RECEBER em dia, com histórico de 2 cobranças
    const loc1 = await prisma.locacao.create({
      data: {
        id: 'demo-loc-1',
        produtoId: produtos[0].id, ...refCliente('demo-cli-1'),
        regra: 'PERCENTUAL_A_RECEBER',
        valorPartida: D('2.00'), percentual: D('0.5'),
        contadorInicial: 1000, dataInicio: diasAtras(60),
        saldoAtual: D('0'), version: BigInt(Date.now()),
      },
    });
    await criarCobranca(loc1.id, admin.id, diasAtras(30), 1000, 1240, '240.00', '240.00');
    await criarCobranca(loc1.id, admin.id, diasAtras(5), 1240, 1410, '170.00', '170.00');
    await prisma.produto.update({ where: { id: produtos[0].id }, data: { contador: 1410 } });

    // 2) VALOR_FIXO mensal, paga parcial → saldo devedor de 100
    const loc2 = await prisma.locacao.create({
      data: {
        id: 'demo-loc-2',
        produtoId: produtos[1].id, ...refCliente('demo-cli-2'),
        regra: 'VALOR_FIXO', frequencia: 'MENSAL', valorFixo: D('300.00'),
        contadorInicial: 0, dataInicio: diasAtras(50),
        saldoAtual: D('100.00'), version: BigInt(Date.now()),
      },
    });
    await criarCobranca(loc2.id, admin.id, diasAtras(20), null, null, '300.00', '200.00', '100.00');

    // 3) PERCENTUAL_A_PAGAR (jukebox)
    const loc3 = await prisma.locacao.create({
      data: {
        id: 'demo-loc-3',
        produtoId: produtos[3].id, ...refCliente('demo-cli-3'),
        regra: 'PERCENTUAL_A_PAGAR',
        valorPartida: D('1.00'), percentual: D('0.4'),
        contadorInicial: 500, dataInicio: diasAtras(40),
        saldoAtual: D('0'), version: BigInt(Date.now()),
      },
    });
    await criarCobranca(loc3.id, admin.id, diasAtras(10), 500, 800, '120.00', '120.00');
    await prisma.produto.update({ where: { id: produtos[3].id }, data: { contador: 800 } });

    // 4) VALOR_FIXO semanal VENCIDA (sem cobrança há 25 dias → ~3 períodos)
    await prisma.locacao.create({
      data: {
        id: 'demo-loc-4',
        produtoId: produtos[2].id, ...refCliente('demo-cli-4'),
        regra: 'VALOR_FIXO', frequencia: 'SEMANAL', valorFixo: D('150.00'),
        contadorInicial: 0, dataInicio: diasAtras(25),
        saldoAtual: D('0'), version: BigInt(Date.now()),
      },
    });

    // 5) Locação FINALIZADA com saldo devedor pendente
    const loc5 = await prisma.locacao.create({
      data: {
        id: 'demo-loc-5',
        produtoId: produtos[4].id, ...refCliente('demo-cli-1'),
        regra: 'VALOR_FIXO', frequencia: 'MENSAL', valorFixo: D('250.00'),
        contadorInicial: 0, dataInicio: diasAtras(120), dataFim: diasAtras(15),
        status: 'FINALIZADA', finalizacaoTipo: 'DEPOSITO', depositoId: deposito.id,
        saldoAtual: D('180.00'), version: BigInt(Date.now()),
      },
    });
    await prisma.saldoDevedorLocacao.create({
      data: {
        locacaoId: loc5.id, clienteId: clientes['demo-cli-1'].clienteId,
        valorOriginal: D('180.00'), valorRestante: D('180.00'),
        version: BigInt(Date.now()),
      },
    });
  }

  console.log('✅ Demo pronta:');
  console.log('   Admin:    CPF 00000000000 / admin123');
  console.log('   Cobrador: CPF 11111111111 / cobrador123 (Rota Norte)');
  console.log('   4 clientes, 5 locações (1 vencida, 1 finalizada com dívida de R$180)');

  function refCliente(id: string) {
    return { clienteId: clientes[id].clienteId, enderecoId: clientes[id].enderecoId };
  }

  async function criarCobranca(
    locacaoId: string, usuarioId: string, data: Date,
    contAnt: number | null, contAtu: number | null,
    liquido: string, pago: string, saldo = '0.00'
  ) {
    const partidas = contAnt != null && contAtu != null ? contAtu - contAnt : null;
    await prisma.cobranca.create({
      data: {
        locacaoId, usuarioId, dataCobranca: data,
        contadorAnterior: contAnt, contadorAtual: contAtu,
        partidasJogadas: partidas, partidasConsideradas: partidas,
        valorBruto: D(liquido), valorLiquidoBase: D(liquido),
        valorLiquidoFinal: D(liquido), valorRecebidoPago: D(pago),
        saldoResultante: D(saldo),
        formaPagamento: 'DINHEIRO',
        statusPagamento: D(pago).gte(D(liquido)) ? 'PAGO' : 'PARCIAL',
        version: BigInt(data.getTime()),
      },
    });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
