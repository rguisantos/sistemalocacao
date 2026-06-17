import { formatarBRL } from '@app/core';

/** Dados necessários para emitir o recibo (já calculados). */
export interface DadosRecibo {
  empresa: string;
  dataISO: string;
  cliente: string;
  produto: string;            // ex.: "P-001 Verde"
  memorial: { rotulo: string; valor: string }[];
  valorLiquidoFinal: string;  // "45.00"
  valorRecebido?: string;
  formaPagamento: string;
  trocaPano: boolean;
}

const PT_PAGAMENTO: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX_MANUAL: 'PIX', CARTAO: 'Cartão', PIX_MERCADO_PAGO: 'PIX (Mercado Pago)',
};

function dataBR(iso: string) { return new Date(iso).toLocaleString('pt-BR'); }

/** HTML para gerar PDF (expo-print). */
export function reciboHtml(d: DadosRecibo): string {
  const linhas = d.memorial.map((m) => `<tr><td>${m.rotulo}</td><td style="text-align:right">${m.valor}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,sans-serif;padding:16px;color:#14201A}
    h1{font-size:18px;margin:0} .sub{color:#6B7B72;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
    td{padding:3px 0} .total{font-size:16px;font-weight:700;margin-top:10px}
    hr{border:none;border-top:1px dashed #999;margin:10px 0}</style></head>
    <body>
      <h1>${d.empresa}</h1><div class="sub">${dataBR(d.dataISO)}</div><hr/>
      <div><strong>Cliente:</strong> ${d.cliente}</div>
      <div><strong>Produto:</strong> ${d.produto}</div><hr/>
      <table>${linhas}</table>
      <div class="total">Valor: ${formatarBRL(d.valorLiquidoFinal)}</div>
      ${d.valorRecebido ? `<div>Recebido/pago: ${formatarBRL(d.valorRecebido)}</div>` : ''}
      <div>Forma: ${PT_PAGAMENTO[d.formaPagamento] ?? d.formaPagamento}</div>
      <div>Troca de pano: ${d.trocaPano ? 'Sim' : 'Não'}</div>
    </body></html>`;
}

// ---- ESC/POS (impressora térmica 58/60mm) ----
const ESC = 0x1b, GS = 0x1d, LF = 0x0a;
class Buffer58 {
  private bytes: number[] = [];
  raw(...b: number[]) { this.bytes.push(...b); return this; }
  init() { return this.raw(ESC, 0x40); }                 // ESC @ — reset
  alinhar(n: 0 | 1 | 2) { return this.raw(ESC, 0x61, n); } // ESC a n
  negrito(on: boolean) { return this.raw(ESC, 0x45, on ? 1 : 0); } // ESC E n
  texto(s: string) { for (const c of s) this.bytes.push(c.charCodeAt(0) & 0xff); return this; }
  linha(s = '') { return this.texto(s).raw(LF); }
  cortar() { return this.raw(GS, 0x56, 0x00); }          // GS V 0 — corte total
  build() { return Uint8Array.from(this.bytes); }
}

/** Comandos ESC/POS do recibo para a impressora Bluetooth (papel 58/60mm). */
export function reciboEscPos(d: DadosRecibo): Uint8Array {
  const b = new Buffer58();
  b.init().alinhar(1).negrito(true).linha(d.empresa).negrito(false);
  b.linha(dataBR(d.dataISO)).alinhar(0).linha('--------------------------------');
  b.linha(`Cliente: ${d.cliente}`).linha(`Produto: ${d.produto}`).linha('--------------------------------');
  for (const m of d.memorial) b.linha(`${m.rotulo}: ${m.valor}`);
  b.linha('--------------------------------');
  b.negrito(true).linha(`VALOR: ${formatarBRL(d.valorLiquidoFinal)}`).negrito(false);
  if (d.valorRecebido) b.linha(`Recebido/pago: ${formatarBRL(d.valorRecebido)}`);
  b.linha(`Forma: ${PT_PAGAMENTO[d.formaPagamento] ?? d.formaPagamento}`);
  b.linha(`Troca de pano: ${d.trocaPano ? 'Sim' : 'Nao'}`);
  b.raw(LF, LF, LF).cortar();
  return b.build();
}
