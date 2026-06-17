import { Injectable } from '@nestjs/common';

export interface MensagemPush { to: string; title: string; body: string; data?: Record<string, unknown>; }

/** Envio via Expo Push API. Faz chunking e devolve tokens inválidos para limpeza. */
@Injectable()
export class ExpoPushService {
  async enviar(mensagens: MensagemPush[]): Promise<{ invalidos: string[] }> {
    const invalidos: string[] = [];
    for (let i = 0; i < mensagens.length; i += 100) {
      const lote = mensagens.slice(i, i + 100);
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lote),
      });
      if (!res.ok) continue;
      const d = await res.json();
      (d.data ?? []).forEach((r: any, idx: number) => {
        if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') invalidos.push(lote[idx].to);
      });
    }
    return { invalidos };
  }
}
