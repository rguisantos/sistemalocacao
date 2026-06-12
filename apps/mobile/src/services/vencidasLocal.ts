// Cálculo de cobranças vencidas direto no SQLite — funciona offline.
// Mesma regra do servidor: valor fixo com período estourado;
// percentual sem leitura há mais de 30 dias.
import { db } from '../db/schema';
import { DIAS_FREQUENCIA } from '@locacoes/shared';

export interface VencidaLocal {
  locacaoId: string;
  clienteId: string;
  diasAtraso: number;
}

const DIAS_PERCENTUAL = 30;

export function listarVencidasLocal(): VencidaLocal[] {
  const rows = db.getAllSync<{
    id: string; cliente_id: string; regra: string; frequencia: string | null;
    referencia: string;
  }>(
    `SELECT l.id, l.cliente_id, l.regra, l.frequencia,
            COALESCE(l.ultima_cobranca_data, l.data_inicio) AS referencia
     FROM locacoes l
     WHERE l.status = 'ATIVA' AND l.is_deleted = 0`
  );

  const agora = Date.now();
  const msDia = 24 * 60 * 60 * 1000;
  const vencidas: VencidaLocal[] = [];

  for (const r of rows) {
    const dias = Math.floor((agora - new Date(r.referencia).getTime()) / msDia);
    const limite =
      r.regra === 'VALOR_FIXO'
        ? DIAS_FREQUENCIA[(r.frequencia as keyof typeof DIAS_FREQUENCIA) ?? 'MENSAL']
        : DIAS_PERCENTUAL;
    if (dias > limite) {
      vencidas.push({ locacaoId: r.id, clienteId: r.cliente_id, diasAtraso: dias - limite });
    }
  }
  return vencidas;
}

/** clienteId -> maior atraso em dias */
export function mapaVencidasPorCliente(): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const v of listarVencidasLocal()) {
    mapa[v.clienteId] = Math.max(mapa[v.clienteId] ?? 0, v.diasAtraso);
  }
  return mapa;
}
