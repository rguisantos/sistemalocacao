import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { criptografar, descriptografar } from '../comum/cripto';

@Injectable()
export class ConfiguracaoService {
  constructor(private readonly prisma: PrismaService) {}

  async definir(chave: string, valor: string) {
    const valorCriptografado = criptografar(valor);
    await this.prisma.configuracao.upsert({
      where: { chave }, update: { valorCriptografado }, create: { chave, valorCriptografado },
    });
  }
  async obter(chave: string): Promise<string | null> {
    const c = await this.prisma.configuracao.findUnique({ where: { chave } });
    return c ? descriptografar(c.valorCriptografado) : null;
  }

  /** Status para a UI — informa o que está configurado SEM expor os segredos. */
  async status() {
    const chaves = (await this.prisma.configuracao.findMany({ select: { chave: true } })).map((c) => c.chave);
    return {
      mercadoPagoConfigurado: chaves.includes('mercadopago.accessToken'),
      webhookConfigurado: chaves.includes('mercadopago.webhookSecret'),
      diasTolerancia: Number((await this.obter('notificacoes.diasTolerancia')) ?? 7),
    };
  }
}
