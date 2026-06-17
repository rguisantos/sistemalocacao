import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfiguracaoService } from './configuracao.service';

const MP_API = 'https://api.mercadopago.com';

@Injectable()
export class MercadoPagoService {
  constructor(private readonly config: ConfiguracaoService) {}

  private async token(): Promise<string> {
    const t = await this.config.obter('mercadopago.accessToken');
    if (!t) throw new BadRequestException('Mercado Pago não configurado.');
    return t;
  }

  /** Cria cobrança PIX e retorna QR + copia-e-cola. external_reference = id da cobrança. */
  async criarPix(cobrancaId: string, valor: number, descricao: string) {
    const res = await fetch(`${MP_API}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.token()}`,
        'X-Idempotency-Key': cobrancaId, // idempotência no lado do MP
      },
      body: JSON.stringify({
        transaction_amount: Number(valor.toFixed(2)),
        description: descricao,
        payment_method_id: 'pix',
        external_reference: cobrancaId,
      }),
    });
    if (!res.ok) throw new BadRequestException('Falha ao criar cobrança PIX.');
    const d = await res.json();
    const tx = d.point_of_interaction?.transaction_data ?? {};
    return { pagamentoId: String(d.id), status: d.status, qrCode: tx.qr_code, qrCodeBase64: tx.qr_code_base64, copiaECola: tx.qr_code };
  }

  async consultarPagamento(pagamentoId: string) {
    const res = await fetch(`${MP_API}/v1/payments/${pagamentoId}`, { headers: { Authorization: `Bearer ${await this.token()}` } });
    if (!res.ok) throw new BadRequestException('Falha ao consultar pagamento.');
    return res.json(); // { status, external_reference, transaction_amount, ... }
  }

  /**
   * Valida a assinatura do webhook (decisão da auditoria — P0).
   * Manifesto: id:<dataId>;request-id:<xRequestId>;ts:<ts>; — HMAC-SHA256 com o segredo do webhook.
   */
  async validarAssinatura(xSignature: string | undefined, xRequestId: string | undefined, dataId: string): Promise<boolean> {
    const segredo = await this.config.obter('mercadopago.webhookSecret');
    if (!segredo || !xSignature) return false;
    const partes = Object.fromEntries(xSignature.split(',').map((p) => p.trim().split('=')));
    const ts = partes['ts']; const v1 = partes['v1'];
    if (!ts || !v1) return false;
    const manifesto = `id:${dataId};request-id:${xRequestId ?? ''};ts:${ts};`;
    const esperado = crypto.createHmac('sha256', segredo).update(manifesto).digest('hex');
    // comparação em tempo constante
    const a = Buffer.from(esperado); const b = Buffer.from(v1);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
