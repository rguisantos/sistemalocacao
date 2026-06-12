// apps/api/src/services/mercadopago.service.ts
import crypto from 'crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { prisma, Prisma } from '@locacoes/database';
import { env } from '../config/env';
import { HttpError } from '../middleware/error';
import { D, calcularSaldoResultante, determinarStatusPagamento } from '@locacoes/shared';
import { registrarAuditoria } from './audit.service';
import { obterConfig } from './configuracao.service';

// Credenciais: painel (banco) tem precedência; env é o fallback.
async function getClient() {
  const token = await obterConfig('mercadopago_access_token', env.MERCADOPAGO_ACCESS_TOKEN);
  if (!token) {
    throw new HttpError(503, 'Integração Mercado Pago não configurada (painel ou env)');
  }
  return new MercadoPagoConfig({ accessToken: token });
}

/**
 * Cria cobrança PIX para uma cobrança já registrada com forma PIX_MERCADO_PAGO.
 * IMPORTANTE: valor em decimal sem parseInt — preserva centavos.
 */
export async function criarPix(cobrancaId: string) {
  const cobranca = await prisma.cobranca.findUnique({
    where: { id: cobrancaId },
    include: { locacao: { include: { cliente: true } } },
  });
  if (!cobranca) throw new HttpError(404, 'Cobrança não encontrada');
  if (cobranca.formaPagamento !== 'PIX_MERCADO_PAGO') {
    throw new HttpError(400, 'Cobrança não é PIX Mercado Pago');
  }
  if (cobranca.pixId) {
    // já criado: retorna o existente
    return {
      pixId: cobranca.pixId,
      qrCode: cobranca.pixQrCode,
      copiaCola: cobranca.pixCopiaCola,
    };
  }

  const valor = D(cobranca.valorLiquidoFinal.toFixed(2)).toNumber();
  if (valor <= 0) throw new HttpError(400, 'Valor da cobrança deve ser positivo');

  const payment = new Payment(await getClient());
  const resp = await payment.create({
    body: {
      transaction_amount: valor,
      payment_method_id: 'pix',
      description: `Cobrança locação — ${cobranca.locacao.cliente.nome}`,
      external_reference: cobranca.id,
      payer: {
        email:
          (await obterConfig('mercadopago_payer_email', env.MERCADOPAGO_PAYER_EMAIL)) ??
          'cliente@example.com',
      },
    },
  });

  const pixId = String(resp.id);
  const qrCode = resp.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
  const copiaCola = resp.point_of_interaction?.transaction_data?.qr_code ?? null;

  await prisma.cobranca.update({
    where: { id: cobrancaId },
    data: { pixId, pixQrCode: qrCode, pixCopiaCola: copiaCola, version: BigInt(Date.now()) },
  });

  return { pixId, qrCode, copiaCola };
}

/**
 * Valida assinatura do webhook (x-signature) conforme doc do Mercado Pago.
 */
export async function validarAssinaturaWebhook(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  dataId: string | undefined
): Promise<boolean> {
  const secret = await obterConfig('mercadopago_webhook_secret', env.MERCADOPAGO_WEBHOOK_SECRET);
  if (!secret) return false;
  if (!xSignature || !xRequestId || !dataId) return false;

  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => p.trim().split('=') as [string, string])
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const esperado = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(v1));
}

/**
 * Processa notificação de pagamento. Busca o pagamento na API do MP
 * (nunca confia no corpo do webhook) e atualiza a cobrança.
 */
export async function processarWebhookPagamento(paymentId: string) {
  const payment = new Payment(await getClient());
  const dados = await payment.get({ id: paymentId });

  const cobrancaId = dados.external_reference;
  if (!cobrancaId) return;

  const cobranca = await prisma.cobranca.findUnique({
    where: { id: cobrancaId },
    include: { locacao: { select: { regra: true } } },
  });
  if (!cobranca) return;

  if (dados.status === 'approved' && cobranca.statusPagamento !== 'PAGO') {
    const valorPago = String(dados.transaction_amount ?? 0);

    // Usa o MESMO engine das cobranças manuais — em PERCENTUAL_A_PAGAR
    // o saldo inverte (pago − devido), e o status respeita pagamento parcial.
    const { saldoResultante } = calcularSaldoResultante(
      cobranca.locacao.regra,
      cobranca.valorLiquidoFinal.toFixed(2),
      valorPago
    );
    const status = determinarStatusPagamento(
      cobranca.valorLiquidoFinal.toFixed(2),
      valorPago
    );

    await prisma.$transaction(async (tx) => {
      await tx.cobranca.update({
        where: { id: cobrancaId },
        data: {
          statusPagamento: status,
          valorRecebidoPago: new Prisma.Decimal(valorPago),
          saldoResultante: new Prisma.Decimal(saldoResultante),
          version: BigInt(Date.now()),
        },
      });
      await tx.locacao.update({
        where: { id: cobranca.locacaoId },
        data: { saldoAtual: new Prisma.Decimal(saldoResultante), version: BigInt(Date.now()) },
      });
    });

    await registrarAuditoria({
      acao: 'pix_confirmado',
      entidade: 'Cobranca',
      entidadeId: cobrancaId,
      dadosNovos: { pixId: paymentId, valor: valorPago.toFixed(2) },
    });
  }
}
