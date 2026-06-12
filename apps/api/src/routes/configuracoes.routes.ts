// Configuração de integrações (Mercado Pago) pelo painel — spec §10.
// Guardado por gerenciar_integracoes_pagamento. Segredos saem MASCARADOS
// na leitura e a auditoria registra apenas QUAIS chaves mudaram, nunca valores.
import { Router } from 'express';
import { z } from 'zod';
import { PERMISSOES } from '@locacoes/shared';
import { exigirPermissao } from '../middleware/auth';
import { registrarAuditoria } from '../services/audit.service';
import {
  obterConfiguracoes, salvarConfiguracoes, mascarar,
} from '../services/configuracao.service';
import { env } from '../config/env';

export const configuracoesRouter = Router();

configuracoesRouter.get(
  '/integracoes',
  exigirPermissao(PERMISSOES.GERENCIAR_INTEGRACOES_PAGAMENTO),
  async (_req, res, next) => {
    try {
      const cfg = await obterConfiguracoes();
      res.json({
        mercadopago: {
          accessToken: mascarar(cfg['mercadopago_access_token'] || env.MERCADOPAGO_ACCESS_TOKEN),
          webhookSecret: mascarar(cfg['mercadopago_webhook_secret'] || env.MERCADOPAGO_WEBHOOK_SECRET),
          payerEmail: cfg['mercadopago_payer_email'] || env.MERCADOPAGO_PAYER_EMAIL || '',
          origem: {
            accessToken: cfg['mercadopago_access_token'] ? 'painel' : env.MERCADOPAGO_ACCESS_TOKEN ? 'env' : 'não configurado',
            webhookSecret: cfg['mercadopago_webhook_secret'] ? 'painel' : env.MERCADOPAGO_WEBHOOK_SECRET ? 'env' : 'não configurado',
          },
        },
      });
    } catch (e) { next(e); }
  }
);

configuracoesRouter.put(
  '/integracoes',
  exigirPermissao(PERMISSOES.GERENCIAR_INTEGRACOES_PAGAMENTO),
  async (req, res, next) => {
    try {
      const input = z.object({
        accessToken: z.string().min(20).optional(),     // campos omitidos não mudam
        webhookSecret: z.string().min(10).optional(),
        payerEmail: z.string().email().optional(),
      }).parse(req.body);

      await salvarConfiguracoes({
        ...(input.accessToken ? { mercadopago_access_token: input.accessToken } : {}),
        ...(input.webhookSecret ? { mercadopago_webhook_secret: input.webhookSecret } : {}),
        ...(input.payerEmail !== undefined ? { mercadopago_payer_email: input.payerEmail } : {}),
      });

      await registrarAuditoria({
        req,
        usuarioId: req.auth!.sub,
        acao: 'atualizar_integracoes_pagamento',
        entidade: 'ConfiguracaoSistema',
        // NUNCA registrar os valores — apenas quais chaves mudaram
        dadosNovos: { chavesAlteradas: Object.keys(input) },
      });

      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);
