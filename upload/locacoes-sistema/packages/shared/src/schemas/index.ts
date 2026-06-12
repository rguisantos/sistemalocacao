import { z } from 'zod';

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^-?\d+(\.\d{1,4})?$/.test(v), 'Valor decimal inválido');

export const loginSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos'),
  senha: z.string().min(4, 'Senha muito curta'),
});

export const usuarioCreateSchema = z.object({
  nome: z.string().min(2),
  cpf: z.string().regex(/^\d{11}$/),
  senha: z.string().min(6),
  ativo: z.boolean().default(true),
  permissoes: z.array(z.string()).default([]),
  rotaIds: z.array(z.string()).default([]),
});

export const usuarioUpdateSchema = usuarioCreateSchema
  .partial()
  .extend({ senha: z.string().min(6).optional() });

export const clienteSchema = z.object({
  tipo: z.enum(['PESSOA_FISICA', 'PESSOA_JURIDICA']).default('PESSOA_FISICA'),
  nome: z.string().min(2),
  razaoSocial: z.string().optional().nullable(),
  cpfCnpj: z.string().optional().nullable(),
  rgInscricaoEstadual: z.string().optional().nullable(),
  telefones: z
    .array(z.object({ numero: z.string(), tipo: z.enum(['celular', 'fixo', 'whatsapp']) }))
    .default([]),
  rotaId: z.string().min(1, 'Rota é obrigatória'),
  observacoes: z.string().optional().nullable(),
});

export const enderecoSchema = z.object({
  logradouro: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional().nullable(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  estado: z.string().length(2),
  cep: z.string().regex(/^\d{8}$/, 'CEP deve conter 8 dígitos'),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  principal: z.boolean().default(false),
});

export const produtoSchema = z.object({
  plaqueta: z.string().min(1),
  tipoProdutoId: z.string().min(1),
  descricao: z.string().optional().nullable(),
  tamanhoId: z.string().optional().nullable(),
  condicaoId: z.string().optional().nullable(),
  chave: z.string().optional().nullable(),
  contador: z.number().int().min(0).default(0),
});

export const locacaoCreateSchema = z
  .object({
    produtoId: z.string().min(1),
    clienteId: z.string().min(1),
    enderecoId: z.string().min(1),
    regra: z.enum(['VALOR_FIXO', 'PERCENTUAL_A_RECEBER', 'PERCENTUAL_A_PAGAR']),
    frequencia: z.enum(['SEMANAL', 'QUINZENAL', 'MENSAL']).optional().nullable(),
    valorFixo: decimalString.optional().nullable(),
    valorPartida: decimalString.optional().nullable(),
    percentual: decimalString.optional().nullable(),
    contadorInicial: z.number().int().min(0),
    dataInicio: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.regra === 'VALOR_FIXO') {
      if (!data.frequencia)
        ctx.addIssue({ code: 'custom', path: ['frequencia'], message: 'Frequência obrigatória para valor fixo' });
      if (!data.valorFixo)
        ctx.addIssue({ code: 'custom', path: ['valorFixo'], message: 'Valor fixo obrigatório' });
    } else {
      if (!data.valorPartida)
        ctx.addIssue({ code: 'custom', path: ['valorPartida'], message: 'Valor da partida obrigatório' });
      if (!data.percentual)
        ctx.addIssue({ code: 'custom', path: ['percentual'], message: 'Percentual obrigatório' });
    }
  });

export const cobrancaCreateSchema = z.object({
  locacaoId: z.string().min(1),
  contadorAtual: z.number().int().min(0).optional().nullable(),
  descontoPartidas: z.number().int().min(0).default(0),
  acrescimo: decimalString.default('0'),
  descontoValorReceber: decimalString.default('0'),
  valorRecebidoPago: decimalString,
  formaPagamento: z.enum(['DINHEIRO', 'PIX_MANUAL', 'CARTAO', 'PIX_MERCADO_PAGO']),
  trocaPano: z.boolean().default(false),
  observacoes: z.string().optional().nullable(),
  dataCobranca: z.coerce.date().optional(),
  syncOrigemId: z.string().optional().nullable(),
});

export const pagamentoSaldoSchema = z.object({
  valor: decimalString,
  formaPagamento: z.enum(['DINHEIRO', 'PIX_MANUAL', 'CARTAO', 'PIX_MERCADO_PAGO']),
  observacoes: z.string().optional().nullable(),
});

export const finalizarLocacaoSchema = z.object({
  tipo: z.enum(['DEPOSITO', 'RELOCACAO']),
  depositoId: z.string().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ClienteInput = z.infer<typeof clienteSchema>;
export type LocacaoCreateInput = z.infer<typeof locacaoCreateSchema>;
export type CobrancaCreateInput = z.infer<typeof cobrancaCreateSchema>;
