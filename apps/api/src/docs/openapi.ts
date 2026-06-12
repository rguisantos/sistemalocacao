// apps/api/src/docs/openapi.ts
// Especificação OpenAPI 3 dos endpoints principais (spec §15).
// Servida em /api/docs (Swagger UI) e /api/docs/openapi.json.
// Mantida compacta: schemas detalhados vivem no Zod (@locacoes/shared).

const bearer = [{ bearerAuth: [] as string[] }];
const r = (description: string) => ({ '200': { description } });

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Sistema de Locações e Cobranças — API',
    version: '1.0.0',
    description:
      'API REST do sistema de locação de equipamentos (mesas de sinuca, jukebox). ' +
      'Autenticação JWT Bearer; refresh tokens opacos com rotação. ' +
      'Dinheiro trafega como string decimal ("150.00"). ' +
      'Validações detalhadas: schemas Zod em `packages/shared`.',
  },
  servers: [{ url: '/', description: 'Este servidor' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  tags: [
    { name: 'Auth' }, { name: 'Usuários' }, { name: 'Clientes' },
    { name: 'Cadastros' }, { name: 'Locações' }, { name: 'Sync' },
    { name: 'Conflitos' }, { name: 'Pagamentos' }, { name: 'Relatórios' },
    { name: 'Configurações' },
  ],
  paths: {
    '/api/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login com CPF e senha',
        description: 'Rate limit: 5 tentativas / 15 min por IP+CPF. Falhas são auditadas com CPF mascarado.',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object',
            properties: { cpf: { type: 'string', example: '00000000000' }, senha: { type: 'string' } },
            required: ['cpf', 'senha'] } } },
        },
        responses: { '200': { description: 'accessToken (15min), refreshToken (7d, rotacionado) e UsuarioDTO com permissões/rotas' }, '401': { description: 'Credenciais inválidas ou usuário inativo' } },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'], summary: 'Rotaciona o refresh token',
        description: 'Reuso de token já rotacionado fora da janela de 60s revoga TODAS as sessões do usuário (detecção de roubo) e audita.',
        responses: { '200': { description: 'Novo par de tokens + UsuarioDTO' }, '401': { description: 'Token inválido/expirado/reusado' } },
      },
    },
    '/api/auth/logout': { post: { tags: ['Auth'], summary: 'Revoga o refresh token atual', responses: r('OK') } },

    '/api/usuarios': {
      get: { tags: ['Usuários'], summary: 'Lista usuários (gerenciar_usuarios)', security: bearer, responses: r('Usuários com permissões e rotas') },
      post: { tags: ['Usuários'], summary: 'Cria usuário com permissões e rotas', security: bearer, responses: r('Usuário criado') },
    },
    '/api/usuarios/{id}': {
      put: {
        tags: ['Usuários'], summary: 'Atualiza usuário', security: bearer,
        description: 'Trocar senha, desativar ou alterar permissões/rotas revoga todas as sessões do usuário.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: r('Usuário atualizado'),
      },
    },

    '/api/clientes': {
      get: { tags: ['Clientes'], summary: 'Lista clientes (filtrados pelas rotas do usuário)', security: bearer, responses: r('Clientes com endereços e contagem de locações') },
      post: { tags: ['Clientes'], summary: 'Cria cliente', security: bearer, responses: r('Cliente criado') },
    },
    '/api/clientes/{id}': {
      get: { tags: ['Clientes'], summary: 'Detalhe com locações e saldos', security: bearer, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: r('Cliente completo') },
      put: { tags: ['Clientes'], summary: 'Edita cliente (transferir rota exige permissão própria)', security: bearer, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: r('Cliente atualizado') },
    },
    '/api/clientes/{id}/enderecos': {
      post: { tags: ['Clientes'], summary: 'Adiciona endereço (lat/long opcionais)', security: bearer, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: r('Endereço criado') },
    },

    '/api/produtos': {
      get: { tags: ['Cadastros'], summary: 'Lista produtos com situação (locado/disponível)', security: bearer, responses: r('Produtos') },
      post: { tags: ['Cadastros'], summary: 'Cria produto (plaqueta única)', security: bearer, responses: r('Produto criado') },
    },
    '/api/produtos/em-deposito': {
      get: { tags: ['Cadastros'], summary: 'Produtos em depósito (última locação finalizada p/ depósito, sem ativa)', security: bearer, responses: r('Produtos em depósito') },
    },

    '/api/locacoes': {
      get: { tags: ['Locações'], summary: 'Lista locações (ativas/finalizadas)', security: bearer, responses: r('Locações') },
      post: { tags: ['Locações'], summary: 'Cria locação', security: bearer, description: 'Valida produto disponível (409 se locado) e endereço pertencente ao cliente. Contador inicial atualiza o produto.', responses: { '201': { description: 'Locação criada' }, '409': { description: 'Produto já possui locação ativa' } } },
    },
    '/api/locacoes/{id}': {
      put: { tags: ['Locações'], summary: 'Edita regra/valores/contador', security: bearer, description: 'Regra/valores exigem editar_regras_locacao; contador exige alterar_contador_locacao (atualiza o produto). Valida coerência da regra resultante. Auditado com antes/depois.', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: r('Locação atualizada') },
    },
    '/api/locacoes/{id}/calcular': {
      post: { tags: ['Locações'], summary: 'Prévia do cálculo (NÃO persiste)', security: bearer, description: 'Retorna passos discriminados e valor líquido final pela regra da locação (valor fixo por períodos; percentuais por partidas).', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: r('Prévia com passos[]') },
    },
    '/api/locacoes/{id}/cobrancas': {
      get: { tags: ['Locações'], summary: 'Histórico de cobranças da locação', security: bearer, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: r('Cobranças') },
      post: { tags: ['Locações'], summary: 'Registra cobrança (transacional)', security: bearer, description: 'Servidor recalcula pelo engine; atualiza saldo da locação e contador do produto na mesma transação. PIX_MERCADO_PAGO cria pagamento e devolve QR/copia-e-cola.', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Cobrança + recibo (passos) + dados PIX se aplicável' }, '400': { description: 'Contador regrediu / validação' } } },
    },
    '/api/locacoes/{id}/finalizar': {
      post: { tags: ['Locações'], summary: 'Finaliza (DEPOSITO ou RELOCACAO)', security: bearer, description: 'Saldo devedor > 0 vira SaldoDevedorLocacao vinculado ao cliente.', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: r('Locação finalizada') },
    },
    '/api/locacoes/saldos': { get: { tags: ['Locações'], summary: 'Saldos devedores (dívidas de locações finalizadas)', security: bearer, responses: r('Saldos') } },
    '/api/locacoes/saldos/{id}/pagamentos': {
      post: { tags: ['Locações'], summary: 'Registra pagamento de dívida (quita ao zerar)', security: bearer, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Pagamento registrado' } } },
    },

    '/api/sync/push': {
      post: { tags: ['Sync'], summary: 'Envia registros offline (lotes ≤500)', security: bearer, description: 'Allowlist por entidade/campo (senha nunca sincroniza). Cobranças e locações passam pelos serviços de negócio (idempotentes por UUID). Conflitos: fast-forward por baseVersion → idêntico → auto-merge de campos seguros → fila manual. Por registro: applied | merged | conflict | error.', responses: r('resultados[]') },
    },
    '/api/sync/pull': {
      post: { tags: ['Sync'], summary: 'Baixa alterações desde lastSyncTimestamp', security: bearer, description: 'Filtrado pelas rotas do usuário. Inclui cobranças (status PIX desce ao aparelho) e pagamentos de saldo.', responses: r('entidades por tipo + timestamp') },
    },

    '/api/conflitos': { get: { tags: ['Conflitos'], summary: 'Fila de conflitos pendentes (diff campo a campo)', security: bearer, responses: r('Conflitos') } },
    '/api/conflitos/{id}/resolver': {
      post: { tags: ['Conflitos'], summary: 'Resolve: manter_servidor | aplicar_mobile | mesclar', security: bearer, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: r('Conflito resolvido (auditado)') },
    },

    '/api/pagamentos/webhook': {
      post: { tags: ['Pagamentos'], summary: 'Webhook Mercado Pago (sem JWT)', description: 'Valida assinatura HMAC (timingSafeEqual); busca o pagamento na API do MP (não confia no body); atualiza status e recalcula saldo pelo engine. Sempre responde 200.', responses: r('OK') },
    },

    '/api/relatorios/dashboard': { get: { tags: ['Relatórios'], summary: 'KPIs do mês + faturamento por rota + top cobradores', security: bearer, responses: r('Dashboard') } },
    '/api/relatorios/flexivel': {
      get: { tags: ['Relatórios'], summary: 'Relatório flexível: dimensão × métricas', security: bearer,
        parameters: [
          { name: 'dimensao', in: 'query', schema: { type: 'string', enum: ['rota', 'cobrador', 'cliente', 'produto', 'forma_pagamento', 'mes', 'dia'] } },
          { name: 'inicio', in: 'query', required: true, schema: { type: 'string', format: 'date-time' } },
          { name: 'fim', in: 'query', required: true, schema: { type: 'string', format: 'date-time' } },
          { name: 'rotaId', in: 'query', schema: { type: 'string' } },
        ],
        responses: r('linhas[]: chave, qtd, valor_devido, valor_recebido') },
    },
    '/api/relatorios/historico-produto/{produtoId}': {
      get: { tags: ['Relatórios'], summary: 'Histórico de locações de um produto', security: bearer, parameters: [{ name: 'produtoId', in: 'path', required: true, schema: { type: 'string' } }], responses: r('Locações com totalRecebido') },
    },
    '/api/relatorios/vencidas': { get: { tags: ['Relatórios'], summary: 'Cobranças vencidas (período estourado / sem leitura)', security: bearer, responses: r('Vencidas com dias de atraso e valor estimado') } },
    '/api/relatorios/extrato-cliente/{clienteId}': {
      get: { tags: ['Relatórios'], summary: 'Extrato de cobranças do cliente', security: bearer, parameters: [{ name: 'clienteId', in: 'path', required: true, schema: { type: 'string' } }], responses: r('Movimentos') },
    },
    '/api/relatorios/auditoria': { get: { tags: ['Relatórios'], summary: 'Logs de auditoria com filtros (retenção: 1 ano)', security: bearer, responses: r('Logs com antes/depois') } },

    '/api/configuracoes/integracoes': {
      get: { tags: ['Configurações'], summary: 'Credenciais MP (mascaradas) e origem (painel/env)', security: bearer, responses: r('Configuração mascarada') },
      put: { tags: ['Configurações'], summary: 'Atualiza credenciais MP (precedência sobre env)', security: bearer, description: 'Auditoria registra apenas quais chaves mudaram — nunca os valores.', responses: r('ok') },
    },
  },
} as const;
