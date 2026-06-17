import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { vencidaValorFixo, vencidaPercentual, Frequencia } from '@app/core';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfiguracaoService } from '../integracao/configuracao.service';
import { ExpoPushService, MensagemPush } from './expo-push.service';

@Injectable()
export class NotificacoesService {
  private readonly log = new Logger('Notificacoes');
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfiguracaoService,
    private readonly push: ExpoPushService,
  ) {}

  /** Job diário (08h): avisa cobradores de locações vencidas. Idempotente por dia. */
  @Cron('0 8 * * *')
  async verificarInadimplencia() {
    const tolStr = await this.config.obter('notificacoes.diasTolerancia');
    const diasTolerancia = Number(tolStr ?? 7);
    const hoje = new Date();
    const hojeKey = hoje.toISOString().slice(0, 10);

    const ativas = await this.prisma.locacao.findMany({
      where: { status: 'ATIVA', deletedAt: null },
      select: {
        id: true, regra: true, frequencia: true, dataInicio: true,
        cliente: { select: { nome: true, rota: { select: { usuarios: { select: { usuario: { select: { id: true, pushToken: true } } } } } } } },
      },
    });

    const mensagens: MensagemPush[] = [];
    for (const l of ativas) {
      const ultima = await this.prisma.cobranca.findFirst({
        where: { locacaoId: l.id, deletedAt: null }, orderBy: { dataCobranca: 'desc' }, select: { dataCobranca: true },
      });
      const ref = ultima?.dataCobranca ?? l.dataInicio;
      const vencida = l.regra === 'VALOR_FIXO'
        ? vencidaValorFixo(l.frequencia as Frequencia, ref, hoje)
        : vencidaPercentual(ref, hoje, diasTolerancia);
      if (!vencida) continue;

      // idempotência: não notifica a mesma locação duas vezes no mesmo dia
      const chave = `notif:${l.id}:${hojeKey}`;
      const n = await this.redis.incr(chave);
      if (n === 1) await this.redis.expire(chave, 172800); else continue;

      for (const ur of l.cliente.rota.usuarios) {
        const tok = ur.usuario.pushToken;
        if (tok) mensagens.push({ to: tok, title: 'Cobrança atrasada', body: `${l.cliente.nome} está com cobrança vencida.`, data: { locacaoId: l.id } });
      }
    }

    if (mensagens.length) {
      const { invalidos } = await this.push.enviar(mensagens);
      if (invalidos.length) await this.prisma.usuario.updateMany({ where: { pushToken: { in: invalidos } }, data: { pushToken: null } });
    }
    this.log.log(`Inadimplência: ${mensagens.length} avisos enviados.`);
    return { enviados: mensagens.length };
  }

  /** Envio manual pelo painel. */
  async enviarManual(usuarioIds: string[], titulo: string, corpo: string) {
    const usuarios = await this.prisma.usuario.findMany({ where: { id: { in: usuarioIds }, pushToken: { not: null } }, select: { pushToken: true } });
    const mensagens = usuarios.map((u) => ({ to: u.pushToken!, title: titulo, body: corpo }));
    const { invalidos } = await this.push.enviar(mensagens);
    if (invalidos.length) await this.prisma.usuario.updateMany({ where: { pushToken: { in: invalidos } }, data: { pushToken: null } });
    return { enviados: mensagens.length };
  }
}
