import { Injectable } from '@nestjs/common';
import {
  Entidade, sanitizarPush, resolver,
} from '@app/core/server';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SaldoService } from '../cobrancas/saldo.service';
import { UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

/** Campos de data convertidos de ISO->Date ao gravar no push. */
const CAMPOS_DATA = new Set(['deletedAt', 'dataInicio', 'dataFim', 'dataCobranca', 'dataPagamento', 'data', 'dataQuitacao']);

/** Entidades sincronizáveis e o delegate Prisma correspondente (mesmo nome camelCase). */
const ENTIDADES: Entidade[] = [
  'rota', 'cliente', 'endereco', 'produto', 'tipoProduto', 'tamanho', 'condicao',
  'deposito', 'locacao', 'cobranca', 'pagamento', 'saldoDevedorLocacao', 'manutencao', 'usuario',
];

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly saldo: SaldoService,
  ) {}

  private async rotasDoUsuario(usuarioId: string): Promise<string[]> {
    const v = await this.prisma.usuarioRota.findMany({ where: { usuarioId }, select: { rotaId: true } });
    return v.map((x) => x.rotaId);
  }

  // -------------------------------------------------------------------------
  // PULL — inclui tombstones (deletedAt != null) e usa o relógio do servidor.
  // Escopo por rota do usuário (anti-IDOR + tamanho de payload).
  // Admin com 'clientes.ler_todas_rotas' vê tudo (bypass de rota).
  // -------------------------------------------------------------------------
  async pull(u: UsuarioRequisicao, lastPulledAt: string | null, fullSync = false) {
    const rotasDoUsuario = await this.rotasDoUsuario(u.id);
    const veTodas = u.permissoes.includes('clientes.ler_todas_rotas');
    const desde = !fullSync && lastPulledAt ? new Date(lastPulledAt) : null;
    const recente = desde ? { updatedAt: { gt: desde } } : {};

    // filtros de escopo por entidade (relation filters do Prisma)
    const escopo: Partial<Record<Entidade, any>> = veTodas
      ? {
          // Admin: sem filtro de rota — vê tudo
          rota: {}, cliente: {}, endereco: {}, locacao: {},
          cobranca: {}, pagamento: {},
          saldoDevedorLocacao: {}, produto: {}, manutencao: {},
          tipoProduto: {}, tamanho: {}, condicao: {}, deposito: {},
          usuario: { id: u.id }, // só o próprio (não vaza credenciais)
        }
      : {
          // Cobrador: escopado por rota
          rota: { id: { in: rotasDoUsuario } },
          cliente: { rotaId: { in: rotasDoUsuario } },
          endereco: { cliente: { rotaId: { in: rotasDoUsuario } } },
          locacao: { cliente: { rotaId: { in: rotasDoUsuario } } },
          cobranca: { locacao: { cliente: { rotaId: { in: rotasDoUsuario } } } },
          pagamento: { OR: [
            { cobranca: { locacao: { cliente: { rotaId: { in: rotasDoUsuario } } } } },
            { saldo: { cliente: { rotaId: { in: rotasDoUsuario } } } },
          ] },
          saldoDevedorLocacao: { cliente: { rotaId: { in: rotasDoUsuario } } },
          produto: { locacoes: { some: { cliente: { rotaId: { in: rotasDoUsuario } } } } },
          manutencao: { produto: { locacoes: { some: { cliente: { rotaId: { in: rotasDoUsuario } } } } } },
          tipoProduto: {}, tamanho: {}, condicao: {}, deposito: {},
          usuario: { id: u.id },
        };

    const mudancas: Partial<Record<Entidade, any[]>> = {};
    for (const ent of ENTIDADES) {
      const where = { ...(escopo[ent] ?? {}), ...recente };
      // usuario: nunca retorna senha/tokenVersao (decisão da auditoria — P0)
      const args: any = { where };
      if (ent === 'usuario') {
        args.select = { id: true, nome: true, cpf: true, ativo: true, pushToken: true, updatedAt: true, deletedAt: true };
      }
      mudancas[ent] = await (this.prisma as any)[ent].findMany(args);
    }

    return { serverTimestamp: new Date().toISOString(), mudancas };
  }

  // -------------------------------------------------------------------------
  // PUSH — allowlist + resolver (append-only/versionado) + conflitos +
  // recálculo de saldo a partir do que veio do campo. Idempotente por lote.
  // -------------------------------------------------------------------------
  async push(u: UsuarioRequisicao, idempotencyKey: string, mudancas: Record<string, any[]>) {
    // Idempotência do lote: primeira ocorrência da chave processa; reenvio é ignorado.
    const chave = `sync:push:${u.id}:${idempotencyKey}`;
    const primeira = await this.setNx(chave, 86400);
    if (!primeira) {
      return { serverTimestamp: new Date().toISOString(), conflitos: [], jaProcessado: true };
    }

    const conflitos: { entidade: string; id: string }[] = [];
    const locacoesAfetadas = new Set<string>();
    const saldosAfetados = new Set<string>();

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const ent of ENTIDADES) {
        let lista = mudancas[ent];
        if (!Array.isArray(lista)) continue;
        // [AUDIT] locação: aplica finalizações/exclusões ANTES das ativações, para
        // liberar `chaveProdutoAtivo` antes que uma nova locação do mesmo produto a reivindique
        // (senão o índice único dispararia dentro da mesma transação de lote).
        if (ent === 'locacao') {
          const peso = (x: any) => (x?.deletedAt || x?.status === 'FINALIZADA' ? 0 : 1);
          lista = [...lista].sort((a, b) => peso(a) - peso(b));
        }
        const delegate = (tx as any)[ent];

        for (const bruto of lista) {
          const limpo = sanitizarPush(ent, bruto) as any;       // allowlist + remove proibidos
          if (!limpo.id) continue;

          const atual = await delegate.findUnique({ where: { id: limpo.id }, select: { id: true, version: true } })
            .catch(() => delegate.findUnique({ where: { id: limpo.id }, select: { id: true } }));
          const decisao = resolver(ent, limpo, { existe: !!atual, version: atual?.version });

          if (decisao.acao === 'IGNORAR_DUPLICADO') continue;

          if (decisao.acao === 'CONFLITO') {
            await tx.conflitoSincronizacao.create({
              data: {
                entidade: ent, entidadeId: limpo.id,
                versaoServidor: decisao.versaoServidor, versaoCliente: decisao.versaoCliente,
                dadosCliente: limpo,
              },
            });
            conflitos.push({ entidade: ent, id: limpo.id });
            continue;
          }

          const dados = this.prepararDados(limpo);
          // [AUDIT] integridade "1 ativo por produto": o sync precisa gerir `chaveProdutoAtivo`
          // (não vem no allowlist). ATIVA → = produtoId (índice único garante unicidade);
          // FINALIZADA/excluída → null (libera o produto, inclusive para re-locação offline).
          if (ent === 'locacao') {
            const ativa = limpo.status === 'ATIVA' && !limpo.deletedAt;
            dados.chaveProdutoAtivo = ativa ? (limpo.produtoId ?? null) : null;
          }
          // [AUDIT] saldo criado no campo: `valorRestante` é obrigatório no schema mas é derivado
          // (fora do allowlist). Inicializa = valorOriginal no insert; o recálculo abaixo ajusta pelos pagamentos.
          if (ent === 'saldoDevedorLocacao' && decisao.acao === 'INSERIR') {
            dados.valorRestante = dados.valorOriginal ?? '0';
            if (!dados.status) dados.status = 'PENDENTE';
          }
          if (decisao.acao === 'INSERIR') {
            await delegate.create({ data: dados });
          } else if (decisao.acao === 'ATUALIZAR') {
            const r = await delegate.updateMany({
              where: { id: limpo.id, version: decisao.novaVersao - 1 },
              data: { ...dados, version: decisao.novaVersao },
            });
            if (r.count === 0) {
              conflitos.push({ entidade: ent, id: limpo.id });
              continue;
            }
          }

          // marca afetados para recálculo de saldo (append-only)
          if (ent === 'cobranca') locacoesAfetadas.add(limpo.locacaoId);
          // saldo recém-criado no campo (finalização offline): deriva valorRestante/status no servidor.
          if (ent === 'saldoDevedorLocacao') saldosAfetados.add(limpo.id);
          if (ent === 'pagamento') {
            if (limpo.cobrancaId) {
              const c = await tx.cobranca.findUnique({ where: { id: limpo.cobrancaId }, select: { locacaoId: true } });
              if (c) locacoesAfetadas.add(c.locacaoId);
            }
            if (limpo.saldoId) saldosAfetados.add(limpo.saldoId);
          }
        }
      }

      // Recalcula saldos a partir do histórico recém-recebido (nunca confia no cliente).
      for (const locacaoId of locacoesAfetadas) await this.saldo.recalcularLocacao(tx, locacaoId);
      for (const saldoId of saldosAfetados) await this.saldo.recalcularSaldoDevedor(tx, saldoId);
    });

    return { serverTimestamp: new Date().toISOString(), conflitos };
  }

  /** Strip de campos não graváveis e conversão de datas ISO->Date. */
  private prepararDados(limpo: any): any {
    const { version, updatedAt, ...resto } = limpo; // updatedAt é gerido pelo servidor; version tratada à parte
    for (const campo of Object.keys(resto)) {
      if (CAMPOS_DATA.has(campo) && resto[campo]) resto[campo] = new Date(resto[campo]);
    }
    return resto;
  }

  /** SET key value EX ttl NX via ioredis (fallback caso o cliente bruto não esteja exposto). */
  private async setNx(chave: string, ttl: number): Promise<boolean> {
    // RedisService expõe incr/expire; emulamos NX com incr+expire (1 = primeiro).
    const n = await this.redis.incr(chave);
    if (n === 1) { await this.redis.expire(chave, ttl); return true; }
    return false;
  }
}
