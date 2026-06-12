import { Router } from 'express';
import { prisma } from '@locacoes/database';
import {
  locacaoCreateSchema, finalizarLocacaoSchema, cobrancaCreateSchema,
  pagamentoSaldoSchema, PERMISSOES,
} from '@locacoes/shared';
import { autenticar, exigirPermissao } from '../middleware/auth';
import * as locacaoService from '../services/locacao.service';
import * as sinalizacaoService from '../services/sinalizacao.service';
import * as cobrancaService from '../services/cobranca.service';
import { criarPix } from '../services/mercadopago.service';
import { HttpError } from '../middleware/error';
import { json } from '../utils';
import { z } from 'zod';

export const locacoesRouter = Router();
locacoesRouter.use(autenticar);

locacoesRouter.get('/', async (req, res, next) => {
  try {
    const { status, clienteId } = req.query as Record<string, string>;
    const locacoes = await prisma.locacao.findMany({
      where: {
        isDeleted: false,
        ...(status ? { status: status as 'ATIVA' | 'FINALIZADA' } : {}),
        ...(clienteId ? { clienteId } : {}),
      },
      include: {
        produto: { include: { tipoProduto: true } },
        cliente: { select: { id: true, nome: true } },
        endereco: true,
        cobrancas: { orderBy: { dataCobranca: 'desc' }, take: 1, where: { isDeleted: false } },
      },
      orderBy: { dataInicio: 'desc' },
    });
    res.json(json(locacoes));
  } catch (e) { next(e); }
});

locacoesRouter.post('/', exigirPermissao(PERMISSOES.CRIAR_EDITAR_LOCACAO), async (req, res, next) => {
  try {
    const input = locacaoCreateSchema.parse(req.body);
    const locacao = await locacaoService.criarLocacao(req.auth!.sub, input);
    res.status(201).json(json(locacao));
  } catch (e) { next(e); }
});

// Bloqueio lógico (spec §6.2): sinaliza que o usuário está cobrando.
// Resposta inclui se OUTRO usuário também está com a locação aberta.
locacoesRouter.post('/:id/sinalizar-cobranca', async (req, res, next) => {
  try {
    const r = await sinalizacaoService.sinalizarCobranca(req.params.id, req.auth!.sub);
    res.json(r);
  } catch (e) { next(e); }
});

locacoesRouter.delete('/:id/sinalizar-cobranca', async (req, res, next) => {
  try {
    await sinalizacaoService.liberarSinalizacao(req.params.id, req.auth!.sub);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Edição de regra/valores/contador (permissões granulares no service)
locacoesRouter.put('/:id', async (req, res, next) => {
  try {
    const input = z.object({
      regra: z.enum(['VALOR_FIXO', 'PERCENTUAL_A_RECEBER', 'PERCENTUAL_A_PAGAR']).optional(),
      frequencia: z.enum(['SEMANAL', 'QUINZENAL', 'MENSAL']).nullable().optional(),
      valorFixo: z.string().nullable().optional(),
      valorPartida: z.string().nullable().optional(),
      percentual: z.string().nullable().optional(),
      contadorAtual: z.number().int().min(0).nullable().optional(),
    }).parse(req.body);
    const locacao = await locacaoService.editarLocacao(
      req.auth!.sub, req.params.id, input, req.auth!.permissoes
    );
    res.json(json(locacao));
  } catch (e) { next(e); }
});

locacoesRouter.post('/:id/finalizar', async (req, res, next) => {
  try {
    const { tipo, depositoId } = finalizarLocacaoSchema.parse(req.body);
    const perm = tipo === 'DEPOSITO'
      ? PERMISSOES.FINALIZAR_LOCACAO_DEPOSITO
      : PERMISSOES.FINALIZAR_LOCACAO_RELOCACAO;
    if (!req.auth!.permissoes.includes(perm)) {
      throw new HttpError(403, 'Permissão insuficiente');
    }
    const resultado = await locacaoService.finalizarLocacao(req.auth!.sub, req.params.id, tipo, depositoId);
    res.json(json(resultado));
  } catch (e) { next(e); }
});

// Prévia do cálculo (botão "Calcular" — não persiste)
locacoesRouter.post('/:id/calcular', exigirPermissao(PERMISSOES.REGISTRAR_COBRANCA), async (req, res, next) => {
  try {
    const params = z.object({
      contadorAtual: z.number().int().optional().nullable(),
      descontoPartidas: z.number().int().min(0).optional(),
      acrescimo: z.string().optional(),
      descontoValorReceber: z.string().optional(),
    }).parse(req.body);
    res.json(await cobrancaService.preverCobranca(req.params.id, params));
  } catch (e) { next(e); }
});

// Registrar cobrança
locacoesRouter.post('/:id/cobrancas', exigirPermissao(PERMISSOES.REGISTRAR_COBRANCA), async (req, res, next) => {
  try {
    const input = cobrancaCreateSchema.parse({ ...req.body, locacaoId: req.params.id });
    if (input.trocaPano && !req.auth!.permissoes.includes(PERMISSOES.MARCAR_TROCA_PANO)) {
      throw new HttpError(403, 'Sem permissão para marcar troca de pano');
    }
    const { cobranca, calc, alerta, duplicada } = await cobrancaService.registrarCobranca(
      req.auth!.sub, input, { ip: req.ip }
    );

    // PIX Mercado Pago: gera cobrança imediatamente
    let pix = null;
    if (input.formaPagamento === 'PIX_MERCADO_PAGO' && !duplicada) {
      pix = await criarPix(cobranca.id);
    }
    res.status(201).json(json({ cobranca, calc, alerta, pix, duplicada }));
  } catch (e) { next(e); }
});

// Histórico de cobranças de uma locação
locacoesRouter.get('/:id/cobrancas', async (req, res, next) => {
  try {
    const cobrancas = await prisma.cobranca.findMany({
      where: { locacaoId: req.params.id, isDeleted: false },
      include: { usuario: { select: { nome: true } } },
      orderBy: { dataCobranca: 'desc' },
    });
    res.json(json(cobrancas));
  } catch (e) { next(e); }
});

// Saldos devedores de locações finalizadas
locacoesRouter.get('/saldos', async (req, res, next) => {
  try {
    const { status = 'PENDENTE', clienteId } = req.query as Record<string, string>;
    const saldos = await prisma.saldoDevedorLocacao.findMany({
      where: {
        isDeleted: false,
        ...(status !== 'TODOS' ? { status: status as 'PENDENTE' | 'QUITADO' } : {}),
        ...(clienteId ? { clienteId } : {}),
      },
      include: {
        cliente: { select: { id: true, nome: true, rota: { select: { nome: true } } } },
        locacao: { include: { produto: { select: { plaqueta: true } } } },
        pagamentos: { orderBy: { dataPagamento: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(json(saldos));
  } catch (e) { next(e); }
});

// Pagamento de saldo devedor (locação finalizada)
locacoesRouter.post('/saldos/:saldoId/pagamentos', exigirPermissao(PERMISSOES.REGISTRAR_COBRANCA), async (req, res, next) => {
  try {
    const input = pagamentoSaldoSchema.parse(req.body);
    const resultado = await locacaoService.pagarSaldoDevedor(
      req.auth!.sub, req.params.saldoId, input.valor, input.formaPagamento, input.observacoes
    );
    res.status(201).json(json(resultado));
  } catch (e) { next(e); }
});
