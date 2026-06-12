// apps/api/src/services/conflito.service.ts
// ============================================================
// RESOLUÇÃO DE CONFLITOS DE SYNC
//
// Cascata de resolução AUTOMÁTICA (na ordem):
//  1. fast-forward  → baseVersion === versão do servidor: ninguém mais
//                     editou desde o pull; aplica direto. Elimina os
//                     falsos conflitos do LWW puro por timestamp.
//  2. idêntico      → dados do mobile == dados do servidor: nada a fazer.
//  3. auto-merge    → os ÚNICOS campos divergentes estão na allowlist
//                     de campos mescláveis da entidade: aplica os valores
//                     do mobile só nesses campos, preserva o resto.
//  4. fila MANUAL   → divergência em campo crítico: registra o conflito
//                     com o diff campo a campo para decisão no painel.
//
// Resolução MANUAL (painel web):
//  manter_servidor | aplicar_mobile | mesclar (payload campo a campo)
// ============================================================
import { prisma } from '@locacoes/database';
import { Prisma } from '@prisma/client';
import { HttpError } from '../middleware/error';
import { registrarAuditoria } from './audit.service';

/** Campos que podem ser mesclados automaticamente sem risco operacional */
const CAMPOS_AUTO_MERGE: Record<string, string[]> = {
  clientes: ['observacoes', 'telefones', 'rgInscricaoEstadual'],
  enderecos: ['complemento', 'latitude', 'longitude'],
  locacoes: [], // regras de cobrança e saldo NUNCA se mesclam sozinhos
};

/** Campos comparáveis por entidade (mesma allowlist do push) */
const CAMPOS_COMPARAVEIS: Record<string, string[]> = {
  clientes: [
    'tipo', 'nome', 'razaoSocial', 'cpfCnpj', 'rgInscricaoEstadual',
    'telefones', 'rotaId', 'observacoes', 'ativo',
  ],
  enderecos: [
    'clienteId', 'logradouro', 'numero', 'complemento', 'bairro',
    'cidade', 'estado', 'cep', 'latitude', 'longitude', 'principal',
  ],
  locacoes: [
    'produtoId', 'clienteId', 'enderecoId', 'regra', 'frequencia',
    'valorFixo', 'valorPartida', 'percentual', 'contadorInicial',
    'dataInicio', 'dataFim', 'status', 'finalizacaoTipo', 'depositoId',
  ],
};

const MODEL_MAP: Record<string, string> = {
  clientes: 'cliente',
  enderecos: 'endereco',
  locacoes: 'locacao',
};

const serializar = (v: unknown) =>
  JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)));

function normalizar(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  // Decimal/numérico: compara valor, não representação ("50" == "50.00")
  const n = Number(v);
  if (!Number.isNaN(n) && String(v).trim() !== '') return String(n);
  return String(v);
}

/** Lista os campos cujo valor diverge entre mobile e servidor */
export function diffCampos(
  entidade: string,
  dadosMobile: Record<string, unknown>,
  registroServidor: Record<string, unknown>
): string[] {
  const campos = CAMPOS_COMPARAVEIS[entidade] ?? [];
  return campos.filter(
    (c) => c in dadosMobile && normalizar(dadosMobile[c]) !== normalizar(registroServidor[c])
  );
}

export type ResultadoResolucaoAuto =
  | { tipo: 'fast_forward' }
  | { tipo: 'identico' }
  | { tipo: 'auto_merge'; campos: string[] }
  | { tipo: 'manual'; campos: string[]; conflitId: string };

/**
 * Tenta resolver automaticamente um push divergente.
 * Chamado pelo sync.service quando o registro já existe no servidor.
 */
export async function tentarResolverAutomatico(opts: {
  entidade: string;
  registroId: string;
  dadosMobile: Record<string, unknown>;
  dadosFiltrados: Record<string, unknown>; // já passados pela allowlist do push
  registroServidor: Record<string, unknown> & { version: bigint };
  baseVersion?: number;
  versionMobile: number;
  usuarioId: string;
  deviceId?: string;
}): Promise<ResultadoResolucaoAuto> {
  const {
    entidade, registroId, dadosMobile, dadosFiltrados,
    registroServidor, baseVersion, versionMobile, usuarioId, deviceId,
  } = opts;
  const model = (prisma as any)[MODEL_MAP[entidade]];

  // 1) FAST-FORWARD: ninguém editou no servidor desde o pull do mobile
  if (baseVersion !== undefined && BigInt(baseVersion) === registroServidor.version) {
    await model.update({
      where: { id: registroId },
      data: { ...dadosFiltrados, version: BigInt(versionMobile) },
    });
    return { tipo: 'fast_forward' };
  }

  const campos = diffCampos(entidade, dadosFiltrados, registroServidor);

  // 2) IDÊNTICO: divergência só de timestamp, dados iguais
  if (campos.length === 0) {
    await prisma.conflitSync.create({
      data: {
        entidade, entidadeId: registroId,
        dadosMobile: serializar(dadosMobile),
        dadosServidor: serializar(registroServidor),
        camposConflitantes: [],
        usuarioOrigemId: usuarioId, deviceId,
        resolvido: true, resolucao: 'auto_identico', resolvidoEm: new Date(),
      },
    });
    return { tipo: 'identico' };
  }

  // 3) AUTO-MERGE: todos os campos divergentes são mescláveis
  const mesclaveis = CAMPOS_AUTO_MERGE[entidade] ?? [];
  if (campos.every((c) => mesclaveis.includes(c))) {
    const patch: Record<string, unknown> = {};
    for (const c of campos) patch[c] = dadosFiltrados[c];

    await model.update({
      where: { id: registroId },
      data: { ...patch, version: BigInt(Date.now()) },
    });
    await prisma.conflitSync.create({
      data: {
        entidade, entidadeId: registroId,
        dadosMobile: serializar(dadosMobile),
        dadosServidor: serializar(registroServidor),
        camposConflitantes: campos,
        usuarioOrigemId: usuarioId, deviceId,
        resolvido: true, resolucao: 'auto_merge',
        dadosResolvidos: serializar(patch), resolvidoEm: new Date(),
      },
    });
    return { tipo: 'auto_merge', campos };
  }

  // 4) MANUAL: campo crítico divergente → fila (servidor vence por ora)
  const conflito = await prisma.conflitSync.create({
    data: {
      entidade, entidadeId: registroId,
      dadosMobile: serializar(dadosMobile),
      dadosServidor: serializar(registroServidor),
      camposConflitantes: campos,
      usuarioOrigemId: usuarioId, deviceId,
    },
  });
  return { tipo: 'manual', campos, conflitId: conflito.id };
}

// ------------------------------------------------------------
// RESOLUÇÃO MANUAL (painel web)
// ------------------------------------------------------------
export async function listarConflitos(filtro: { resolvido?: boolean; entidade?: string }) {
  return prisma.conflitSync.findMany({
    where: {
      ...(filtro.resolvido !== undefined ? { resolvido: filtro.resolvido } : {}),
      ...(filtro.entidade ? { entidade: filtro.entidade } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function resolverConflito(
  conflitId: string,
  resolucao: 'manter_servidor' | 'aplicar_mobile' | 'mesclar',
  resolvidoPor: string,
  camposMesclados?: Record<string, unknown>
) {
  const conflito = await prisma.conflitSync.findUnique({ where: { id: conflitId } });
  if (!conflito) throw new HttpError(404, 'Conflito não encontrado');
  if (conflito.resolvido) throw new HttpError(400, 'Conflito já resolvido');

  const model = (prisma as any)[MODEL_MAP[conflito.entidade]];
  if (!model) throw new HttpError(400, `Entidade não suportada: ${conflito.entidade}`);

  const comparaveis = CAMPOS_COMPARAVEIS[conflito.entidade] ?? [];
  let dadosResolvidos: Record<string, unknown> | null = null;

  if (resolucao === 'aplicar_mobile') {
    const dadosMobile = conflito.dadosMobile as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const c of comparaveis) if (c in dadosMobile) patch[c] = dadosMobile[c];
    await model.update({
      where: { id: conflito.entidadeId },
      data: { ...patch, version: BigInt(Date.now()) },
    });
    dadosResolvidos = patch;
  } else if (resolucao === 'mesclar') {
    if (!camposMesclados || Object.keys(camposMesclados).length === 0) {
      throw new HttpError(400, 'Informe os campos a mesclar');
    }
    const patch: Record<string, unknown> = {};
    for (const [c, v] of Object.entries(camposMesclados)) {
      if (!comparaveis.includes(c)) {
        throw new HttpError(400, `Campo não permitido: ${c}`);
      }
      patch[c] = v;
    }
    await model.update({
      where: { id: conflito.entidadeId },
      data: { ...patch, version: BigInt(Date.now()) },
    });
    dadosResolvidos = patch;
  }
  // manter_servidor: nenhuma escrita na entidade

  const atualizado = await prisma.conflitSync.update({
    where: { id: conflitId },
    data: {
      resolvido: true,
      resolucao,
      dadosResolvidos: dadosResolvidos ? serializar(dadosResolvidos) : Prisma.JsonNull,
      resolvidoPor,
      resolvidoEm: new Date(),
    },
  });

  await registrarAuditoria({
    usuarioId: resolvidoPor,
    acao: `resolver_conflito_${resolucao}`,
    entidade: conflito.entidade,
    entidadeId: conflito.entidadeId,
    dadosNovos: { conflitId, resolucao, camposMesclados },
  });

  return atualizado;
}

export async function estatisticasConflitos() {
  const [pendentes, porEntidade, autoResolvidos] = await Promise.all([
    prisma.conflitSync.count({ where: { resolvido: false } }),
    prisma.conflitSync.groupBy({
      by: ['entidade'],
      where: { resolvido: false },
      _count: true,
    }),
    prisma.conflitSync.count({
      where: { resolvido: true, resolucao: { in: ['auto_identico', 'auto_merge'] } },
    }),
  ]);
  return { pendentes, porEntidade, autoResolvidos };
}
