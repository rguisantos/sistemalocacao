/**
 * Catálogo de permissões (matriz da spec) + papéis-preset (decisão da auditoria — P2).
 * Fonte única usada pelo módulo de usuários e pelo seed.
 */
export const PERMISSOES: { chave: string; descricao: string }[] = [
  // Administração
  { chave: 'admin.usuarios.ler', descricao: 'Ler usuários' },
  { chave: 'admin.usuarios.criar', descricao: 'Criar usuários' },
  { chave: 'admin.usuarios.editar', descricao: 'Editar usuários' },
  { chave: 'admin.usuarios.excluir', descricao: 'Excluir usuários' },
  { chave: 'admin.permissoes.atribuir', descricao: 'Atribuir permissões' },
  { chave: 'admin.auditoria.ler', descricao: 'Ler logs de auditoria' },
  // Auxiliares
  { chave: 'auxiliares.tipos.ler', descricao: 'Ler tipos de produto' },
  { chave: 'auxiliares.tipos.criar', descricao: 'Criar tipos de produto' },
  { chave: 'auxiliares.tipos.editar', descricao: 'Editar tipos de produto' },
  { chave: 'auxiliares.tipos.excluir', descricao: 'Excluir tipos de produto' },
  { chave: 'auxiliares.tamanhos.ler', descricao: 'Ler tamanhos' },
  { chave: 'auxiliares.tamanhos.criar', descricao: 'Criar tamanhos' },
  { chave: 'auxiliares.tamanhos.editar', descricao: 'Editar tamanhos' },
  { chave: 'auxiliares.tamanhos.excluir', descricao: 'Excluir tamanhos' },
  { chave: 'auxiliares.condicoes.ler', descricao: 'Ler condições' },
  { chave: 'auxiliares.condicoes.criar', descricao: 'Criar condições' },
  { chave: 'auxiliares.condicoes.editar', descricao: 'Editar condições' },
  { chave: 'auxiliares.condicoes.excluir', descricao: 'Excluir condições' },
  // Produtos
  { chave: 'produtos.ler', descricao: 'Ler produtos' },
  { chave: 'produtos.criar', descricao: 'Criar produtos' },
  { chave: 'produtos.editar', descricao: 'Editar produtos' },
  { chave: 'produtos.alterar_contador', descricao: 'Alterar contador do produto' },
  { chave: 'produtos.excluir', descricao: 'Excluir produtos' },
  // Depósitos
  { chave: 'depositos.ler', descricao: 'Ler depósitos' },
  { chave: 'depositos.criar', descricao: 'Criar depósitos' },
  { chave: 'depositos.editar', descricao: 'Editar depósitos' },
  { chave: 'depositos.excluir', descricao: 'Excluir depósitos' },
  // Rotas
  { chave: 'rotas.ler', descricao: 'Ler rotas' },
  { chave: 'rotas.criar', descricao: 'Criar rotas' },
  { chave: 'rotas.editar', descricao: 'Editar rotas' },
  { chave: 'rotas.excluir', descricao: 'Excluir rotas' },
  // Clientes
  { chave: 'clientes.ler', descricao: 'Ler clientes das próprias rotas' },
  { chave: 'clientes.ler_todas_rotas', descricao: 'Ler clientes de todas as rotas' },
  { chave: 'clientes.criar', descricao: 'Criar clientes' },
  { chave: 'clientes.editar', descricao: 'Editar clientes' },
  { chave: 'clientes.excluir', descricao: 'Excluir clientes' },
  { chave: 'clientes.transferir_rota', descricao: 'Transferir cliente de rota' },
  // Locações
  { chave: 'locacoes.ler', descricao: 'Ler locações' },
  { chave: 'locacoes.criar', descricao: 'Criar locações' },
  { chave: 'locacoes.editar', descricao: 'Editar locações' },
  { chave: 'locacoes.finalizar_deposito', descricao: 'Finalizar locação para depósito' },
  { chave: 'locacoes.finalizar_relocacao', descricao: 'Finalizar locação por relocação' },
  { chave: 'locacoes.excluir', descricao: 'Excluir locações' },
  // Cobranças
  { chave: 'cobrancas.ler', descricao: 'Ler cobranças' },
  { chave: 'cobrancas.criar', descricao: 'Registrar cobranças' },
  { chave: 'cobrancas.editar', descricao: 'Editar cobranças' },
  { chave: 'cobrancas.marcar_troca_pano', descricao: 'Marcar troca de pano' },
  { chave: 'cobrancas.forma_pagamento.mercado_pago', descricao: 'Usar PIX Mercado Pago' },
  // Manutenções
  { chave: 'manutencoes.ler', descricao: 'Ler manutenções' },
  { chave: 'manutencoes.criar', descricao: 'Criar manutenções' },
  { chave: 'manutencoes.editar', descricao: 'Editar manutenções' },
  { chave: 'manutencoes.excluir', descricao: 'Excluir manutenções' },
  // Relatórios
  { chave: 'relatorios.ler', descricao: 'Acessar relatórios' },
  { chave: 'relatorios.exportar_pdf', descricao: 'Exportar relatórios em PDF/Excel' },
];

export const PAPEIS: Record<string, string[]> = {
  Administrador: PERMISSOES.map((p) => p.chave),
  Secretario: [
    'admin.usuarios.ler', 'rotas.ler', 'depositos.ler', 'produtos.ler', 'produtos.criar', 'produtos.editar',
    'auxiliares.tipos.ler', 'auxiliares.tamanhos.ler', 'auxiliares.condicoes.ler',
    'clientes.ler', 'clientes.ler_todas_rotas', 'clientes.criar', 'clientes.editar', 'clientes.transferir_rota',
    'locacoes.ler', 'locacoes.criar', 'cobrancas.ler', 'manutencoes.ler',
    'relatorios.ler',
  ],
  AcessoControlado: [
    'clientes.ler', 'locacoes.ler', 'cobrancas.ler', 'cobrancas.criar',
    'cobrancas.marcar_troca_pano', 'manutencoes.ler', 'manutencoes.criar',
  ],
};
