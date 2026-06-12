// apps/api/src/services/sinalizacao.service.ts
// Bloqueio LÓGICO de locação (spec §6.2): sinalização, quando online,
// de que outro usuário está com a mesma locação aberta para cobrança.
// Não impede a operação (offline-first não permite lock real) — apenas
// avisa, para evitar cobranças duplicadas em campo. A idempotência e a
// fila de conflitos continuam sendo a defesa de fato.
//
// Armazenamento: Redis com TTL (compartilhado entre instâncias) e
// fallback em memória para desenvolvimento.
import Redis from 'ioredis';
import { prisma } from '@locacoes/database';
import { env } from '../config/env';

const TTL_SEG = 300; // sinalização expira em 5 min sem renovação

interface Sinal {
  usuarioId: string;
  nome: string;
  desde: number;
}

let redis: Redis | null = null;
if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
  redis.on('error', (e) => console.error('[redis:sinalizacao]', e.message));
}

// Fallback memória (vale por instância — suficiente para dev)
const memoria = new Map<string, Sinal & { expira: number }>();
function limparMemoria() {
  const agora = Date.now();
  for (const [k, v] of memoria) if (v.expira < agora) memoria.delete(k);
}

const chave = (locacaoId: string) => `cobrando:${locacaoId}`;

/**
 * Registra/renova a sinalização do usuário e devolve quem MAIS está
 * com a locação aberta (se houver).
 */
export async function sinalizarCobranca(
  locacaoId: string,
  usuarioId: string
): Promise<{ outroUsuario: { nome: string; desde: number } | null }> {
  // nome não viaja no JWT — busca leve, fora do hot path
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true },
  });
  const sinal: Sinal = { usuarioId, nome: usuario?.nome ?? 'Outro usuário', desde: Date.now() };

  if (redis && redis.status === 'ready') {
    const k = chave(locacaoId);
    const atual = await redis.get(k);
    if (atual) {
      const existente: Sinal = JSON.parse(atual);
      if (existente.usuarioId !== usuarioId) {
        // outro usuário sinalizou primeiro: NÃO sobrescreve, só avisa
        return { outroUsuario: { nome: existente.nome, desde: existente.desde } };
      }
    }
    await redis.set(k, JSON.stringify(sinal), 'EX', TTL_SEG);
    return { outroUsuario: null };
  }

  limparMemoria();
  const existente = memoria.get(chave(locacaoId));
  if (existente && existente.usuarioId !== usuarioId) {
    return { outroUsuario: { nome: existente.nome, desde: existente.desde } };
  }
  memoria.set(chave(locacaoId), { ...sinal, expira: Date.now() + TTL_SEG * 1000 });
  return { outroUsuario: null };
}

/** Libera a sinalização ao sair da tela (apenas se for do próprio usuário). */
export async function liberarSinalizacao(locacaoId: string, usuarioId: string): Promise<void> {
  if (redis && redis.status === 'ready') {
    const k = chave(locacaoId);
    const atual = await redis.get(k);
    if (atual && (JSON.parse(atual) as Sinal).usuarioId === usuarioId) {
      await redis.del(k);
    }
    return;
  }
  const existente = memoria.get(chave(locacaoId));
  if (existente && existente.usuarioId === usuarioId) {
    memoria.delete(chave(locacaoId));
  }
}
