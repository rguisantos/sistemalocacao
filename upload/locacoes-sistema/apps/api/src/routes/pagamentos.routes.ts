import { Router } from 'express';
import { validarAssinaturaWebhook, processarWebhookPagamento } from '../services/mercadopago.service';

export const pagamentosRouter = Router();

/**
 * Webhook Mercado Pago. SEM autenticação JWT (chamado pelo MP),
 * MAS valida assinatura HMAC do header x-signature.
 */
pagamentosRouter.post('/webhook', async (req, res) => {
  try {
    const dataId = (req.query['data.id'] as string) ?? req.body?.data?.id;
    const valida = await validarAssinaturaWebhook(
      req.headers['x-signature'] as string | undefined,
      req.headers['x-request-id'] as string | undefined,
      dataId
    );
    if (!valida) {
      return res.status(401).json({ error: 'Assinatura inválida' });
    }
    if (req.body?.type === 'payment' && dataId) {
      // processa async; responde 200 rápido para o MP não reenviar
      processarWebhookPagamento(String(dataId)).catch((e) =>
        console.error('[webhook MP] erro ao processar:', e)
      );
    }
    res.status(200).json({ ok: true });
  } catch {
    res.status(200).json({ ok: true }); // nunca retornar 5xx em loop para o MP
  }
});
