// apps/api/src/services/sync.service.ts
import { prisma } from '@locacoes/database';
import type {
  SyncPushRecord,
  SyncPushResult,
  SyncPullResponse,
  CobrancaCreateInput,
} from '@locacoes/shared';
import { registrarCobranca } from './cobranca.service';
import { criarLocacao, finalizarLocacao } from './locacao.service';
import { tentarResolverAutomatico } from './conflito.service';
import { locacaoCreateSchema } from '@locacoes/shared';

/**
 * SEGURANÇA: lista explícita de entidades e campos que o mobile PODE enviar.
 * - `senha`/`senhaHash` NUNCA entram aqui (bug histórico corrigido por design).
 * - Cobranças passam pelo serviço transacional (recalcula no servidor).
 */
const ENTIDADES_PUSH: Record<string, { campos: string[] }> = {
  clientes: {
    campos: [
      'tipo', 'nome', 'razaoSocial', 'cpfCnpj', 'rgInscricaoEstadual',
      'telefones', 'rotaId', 'observacoes', 'ativo',
    ],
  },
  enderecos: {
    campos: [
      'clienteId', 'logradouro', 'numero', 'complemento', 'bairro',
      'cidade', 'estado', 'cep', 'latitude', 'longitude', 'principal',
    ],
  },
  locacoes: {
    campos: [
      'produtoId', 'clienteId', 'enderecoId', 'regra', 'frequencia',
      'valorFixo', 'valorPartida', 'percentual', 'contadorInicial',
      'dataInicio', 'dataFim', 'status', 'finalizacaoTipo', 'depositoId',
    ],
  },
};

const MODEL_MAP: Record<string, string> = {
  clientes: 'cliente',
  enderecos: 'endereco',
  locacoes: 'locacao',
};

function filtrarCampos(entidade: string, dados: Record<string, unknown>) {
  const permitidos = ENTIDADES_PUSH[entidade]?.campos ?? [];
  const out: Record<string, unknown> = {};
  for (const k of permitidos) {
    if (k in dados) out[k] = dados[k];
  }
  return out;
}

export async function processarPush(
  usuarioId: string,
  registros: SyncPushRecord[],
  deviceId?: string
): Promise<SyncPushResult[]> {
  const resultados: SyncPushResult[] = [];

  for (const reg of registros) {
    try {
      // --- Cobranças: caminho especial, transacional e idempotente ---
      if (reg.entidade === 'cobrancas') {
        if (reg.operacao !== 'create') {
          resultados.push({
            id: reg.id,
            status: 'error',
            mensagem: 'Cobranças não podem ser editadas via sync',
          });
          continue;
        }
        const input = { ...reg.dados, syncOrigemId: reg.id } as unknown as CobrancaCreateInput;
        const { duplicada } = await registrarCobranca(usuarioId, input);
        resultados.push({
          id: reg.id,
          status: 'applied',
          mensagem: duplicada ? 'Já aplicada anteriormente (idempotente)' : undefined,
        });
        continue;
      }

      // --- Locações: regras de negócio do servidor sempre se aplicam ---
      if (reg.entidade === 'locacoes') {
        if (reg.operacao === 'create') {
          // Validação completa (produto disponível, endereço do cliente,
          // contador) + idempotência pelo UUID do mobile.
          const input = locacaoCreateSchema.parse(reg.dados);
          await criarLocacao(usuarioId, input, reg.id);
          resultados.push({ id: reg.id, status: 'applied' });
          continue;
        }
        // Finalização em campo: dispara a lógica oficial
        // (data_fim, depósito e criação do SaldoDevedorLocacao).
        if (reg.operacao === 'update' && reg.dados.status === 'FINALIZADA') {
          const atual = await prisma.locacao.findUnique({ where: { id: reg.id } });
          if (!atual) {
            resultados.push({ id: reg.id, status: 'error', mensagem: 'Locação não encontrada' });
            continue;
          }
          if (atual.status === 'FINALIZADA') {
            resultados.push({ id: reg.id, status: 'applied', mensagem: 'Já finalizada (idempotente)' });
            continue;
          }
          const tipo = reg.dados.finalizacaoTipo as 'DEPOSITO' | 'RELOCACAO';
          const depositoId = (reg.dados.depositoId as string | null) ?? null;
          await finalizarLocacao(usuarioId, reg.id, tipo, depositoId);
          resultados.push({ id: reg.id, status: 'applied' });
          continue;
        }
        // Outros updates de locação seguem o fluxo genérico abaixo
        // (com cascata de conflitos), pois alteram campos não-críticos.
      }

      // --- Entidades genéricas: last-write-wins por version ---
      const modelKey = MODEL_MAP[reg.entidade];
      if (!modelKey || !ENTIDADES_PUSH[reg.entidade]) {
        resultados.push({ id: reg.id, status: 'error', mensagem: `Entidade não sincronizável: ${reg.entidade}` });
        continue;
      }
      const model = (prisma as any)[modelKey];
      const dados = filtrarCampos(reg.entidade, reg.dados);

      const existente = await model.findUnique({ where: { id: reg.id } });

      if (reg.operacao === 'delete') {
        if (existente) {
          await model.update({
            where: { id: reg.id },
            data: { isDeleted: true, version: BigInt(reg.version) },
          });
        }
        resultados.push({ id: reg.id, status: 'applied' });
        continue;
      }

      if (!existente) {
        await model.create({
          data: { id: reg.id, ...dados, version: BigInt(reg.version) },
        });
        resultados.push({ id: reg.id, status: 'applied' });
        continue;
      }

      // Divergência: cascata de resolução automática
      // (fast-forward → idêntico → auto-merge → fila manual)
      if (BigInt(reg.version) <= existente.version || reg.baseVersion !== undefined) {
        const resolucao = await tentarResolverAutomatico({
          entidade: reg.entidade,
          registroId: reg.id,
          dadosMobile: reg.dados,
          dadosFiltrados: dados,
          registroServidor: existente,
          baseVersion: reg.baseVersion,
          versionMobile: reg.version,
          usuarioId,
          deviceId,
        });

        if (resolucao.tipo === 'fast_forward') {
          resultados.push({ id: reg.id, status: 'applied' });
        } else if (resolucao.tipo === 'identico') {
          resultados.push({ id: reg.id, status: 'applied', mensagem: 'Dados já idênticos no servidor' });
        } else if (resolucao.tipo === 'auto_merge') {
          const atual = await model.findUnique({ where: { id: reg.id } });
          resultados.push({
            id: reg.id,
            status: 'merged',
            mensagem: `Mesclado automaticamente: ${resolucao.campos.join(', ')}`,
            dadosServidor: JSON.parse(
              JSON.stringify(atual, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
            ),
          });
        } else {
          resultados.push({
            id: reg.id,
            status: 'conflict',
            mensagem: `Conflito em: ${resolucao.campos.join(', ')}. Aguardando resolução no painel.`,
            dadosServidor: JSON.parse(
              JSON.stringify(existente, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
            ),
          });
        }
        continue;
      }

      await model.update({
        where: { id: reg.id },
        data: { ...dados, version: BigInt(reg.version) },
      });
      resultados.push({ id: reg.id, status: 'applied' });
    } catch (e: any) {
      resultados.push({ id: reg.id, status: 'error', mensagem: e?.message ?? 'Erro desconhecido' });
    }
  }

  return resultados;
}

/**
 * Pull incremental. Cobradores recebem apenas dados das suas rotas
 * (a menos que tenham visualizar_clientes_todas_rotas).
 * Soft-deleted são ENVIADOS (com isDeleted=true) para o mobile remover localmente.
 */
export async function processarPull(
  auth: { sub: string; permissoes: string[]; rotaIds: string[] },
  lastSyncTimestamp: number
): Promise<SyncPullResponse> {
  const desde = new Date(lastSyncTimestamp);
  const agora = Date.now();
  const todasRotas = auth.permissoes.includes('visualizar_clientes_todas_rotas');
  const filtroRota = todasRotas ? {} : { rotaId: { in: auth.rotaIds } };

  const updatedAtFiltro = { updatedAt: { gt: desde } };

  const [rotas, clientes, tiposProduto, tamanhos, condicoes, depositos] = await Promise.all([
    prisma.rota.findMany({
      where: { ...updatedAtFiltro, ...(todasRotas ? {} : { id: { in: auth.rotaIds } }) },
    }),
    prisma.cliente.findMany({ where: { ...updatedAtFiltro, ...filtroRota }, include: { enderecos: true } }),
    prisma.tipoProduto.findMany({ where: updatedAtFiltro }),
    prisma.tamanho.findMany({ where: updatedAtFiltro }),
    prisma.condicao.findMany({ where: updatedAtFiltro }),
    prisma.deposito.findMany({ where: updatedAtFiltro }),
  ]);

  const clienteIds = todasRotas
    ? undefined
    : (
        await prisma.cliente.findMany({
          where: filtroRota,
          select: { id: true },
        })
      ).map((c) => c.id);

  const filtroCliente = clienteIds ? { clienteId: { in: clienteIds } } : {};

  const [locacoes, saldosDevedores, cobrancas, pagamentosSaldo] = await Promise.all([
    prisma.locacao.findMany({
      where: { ...updatedAtFiltro, ...filtroCliente },
      include: {
        cobrancas: { orderBy: { dataCobranca: 'desc' }, take: 1, where: { isDeleted: false } },
      },
    }),
    prisma.saldoDevedorLocacao.findMany({ where: { ...updatedAtFiltro, ...filtroCliente } }),
    // Cobranças incrementais: leva o status PIX (webhook) e o histórico
    // de outros aparelhos/painel para o app — habilita histórico offline.
    prisma.cobranca.findMany({
      where: {
        ...updatedAtFiltro,
        ...(clienteIds ? { locacao: { clienteId: { in: clienteIds } } } : {}),
      },
      select: {
        id: true, locacaoId: true, usuarioId: true, dataCobranca: true,
        contadorAnterior: true, contadorAtual: true,
        valorLiquidoFinal: true, valorRecebidoPago: true, saldoResultante: true,
        formaPagamento: true, statusPagamento: true, trocaPano: true,
        pixCopiaCola: true, syncOrigemId: true, isDeleted: true, version: true,
        usuario: { select: { nome: true } },
      },
      orderBy: { dataCobranca: 'asc' },
      take: 2000,
    }),
    prisma.pagamentoSaldo.findMany({
      where: {
        createdAt: { gt: desde },
        ...(clienteIds ? { saldo: { clienteId: { in: clienteIds } } } : {}),
      },
      select: {
        id: true, saldoId: true, valor: true, formaPagamento: true,
        dataPagamento: true, observacoes: true,
      },
      take: 2000,
    }),
  ]);

  const produtoIds = locacoes.map((l) => l.produtoId);
  const produtos = await prisma.produto.findMany({
    where: { OR: [{ updatedAt: { gt: desde } }, { id: { in: produtoIds } }] },
  });

  const serializar = (arr: unknown[]) =>
    JSON.parse(JSON.stringify(arr, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));

  return {
    timestamp: agora,
    entidades: {
      rotas: serializar(rotas),
      clientes: serializar(clientes),
      produtos: serializar(produtos),
      tiposProduto: serializar(tiposProduto),
      tamanhos: serializar(tamanhos),
      condicoes: serializar(condicoes),
      depositos: serializar(depositos),
      locacoes: serializar(locacoes),
      saldosDevedores: serializar(saldosDevedores),
      cobrancas: serializar(cobrancas),
      pagamentosSaldo: serializar(pagamentosSaldo),
    },
  };
}
