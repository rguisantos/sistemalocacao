import { Body, Controller, Get, Headers, Post, Query, HttpCode, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MercadoPagoService } from './mercadopago.service';
import { ConfiguracaoService } from './configuracao.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaldoService } from '../cobrancas/saldo.service';
import { RequerPermissoes } from '../comum/decorators/permissoes.decorator';
import { Publico } from '../comum/decorators/publico.decorator';
import { UsuarioAtual, UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@ApiTags('integracao')
@Controller('integracao')
export class IntegracaoController {
  constructor(
    private readonly mp: MercadoPagoService,
    private readonly config: ConfiguracaoService,
    private readonly prisma: PrismaService,
    private readonly saldo: SaldoService,
  ) {}

  @ApiBearerAuth()
  @Get('config/status')
  @RequerPermissoes('integracao.configurar')
  @ApiOperation({ summary: 'O que está configurado (sem expor segredos)' })
  status() { return this.config.status(); }

  @ApiBearerAuth()
  @Post('config')
  @RequerPermissoes('integracao.configurar')
  @ApiOperation({ summary: 'Define credenciais (criptografadas at-rest)' })
  async configurar(@Body() body: { accessToken?: string; webhookSecret?: string; diasTolerancia?: number }) {
    if (body.accessToken) await this.config.definir('mercadopago.accessToken', body.accessToken);
    if (body.webhookSecret) await this.config.definir('mercadopago.webhookSecret', body.webhookSecret);
    if (body.diasTolerancia != null) await this.config.definir('notificacoes.diasTolerancia', String(body.diasTolerancia));
    return { ok: true };
  }

  @ApiBearerAuth()
  @Post('pix')
  @RequerPermissoes('cobrancas.forma_pagamento.mercado_pago')
  @ApiOperation({ summary: 'Gera cobrança PIX (online) para uma cobrança existente' })
  async gerarPix(@Body() body: { cobrancaId: string }, @UsuarioAtual() _u: UsuarioRequisicao) {
    const cobranca = await this.prisma.cobranca.findUnique({ where: { id: body.cobrancaId } });
    if (!cobranca) throw new BadRequestException('Cobrança não encontrada.');
    const pix = await this.mp.criarPix(cobranca.id, Number(cobranca.valorLiquidoFinal), `Cobrança ${cobranca.id}`);
    await this.prisma.cobranca.update({ where: { id: cobranca.id }, data: { pixId: pix.pagamentoId } });
    return pix;
  }

  // WEBHOOK — público, mas validado por assinatura + idempotente.
  @Publico()
  @Post('mercadopago/webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Query() query: any,
    @Body() body: any,
  ) {
    // MP envia o id no corpo (data.id) e/ou na query (?data.id=). O Express/qs
    // aninha "data.id" em query.data.id, então cobrimos as duas formas.
    const dataId = body?.data?.id ? String(body.data.id) : (query?.data?.id ?? query?.['data.id']);
    if (!dataId) return { ignorado: true };

    const valido = await this.mp.validarAssinatura(xSignature, xRequestId, dataId);
    if (!valido) throw new BadRequestException('Assinatura inválida.'); // [AUDIT P0]

    const pagamento = await this.mp.consultarPagamento(dataId);
    if (pagamento.status !== 'approved') return { status: pagamento.status }; // só age em aprovados

    const cobrancaId = pagamento.external_reference;
    // Idempotência: se já há um Pagamento com este pixId, não duplica.
    const jaRegistrado = await this.prisma.pagamento.findFirst({ where: { pixId: dataId } });
    if (jaRegistrado) return { status: 'approved', idempotente: true };

    const cobranca = await this.prisma.cobranca.findUnique({ where: { id: cobrancaId } });
    if (!cobranca) return { status: 'approved', cobrancaNaoEncontrada: true };

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.pagamento.create({
        data: {
          alvo: 'COBRANCA', cobrancaId: cobranca.id, usuarioId: cobranca.usuarioId,
          valor: Number(pagamento.transaction_amount).toFixed(2), formaPagamento: 'PIX_MERCADO_PAGO',
          pixId: dataId, dataPagamento: new Date(),
        },
      });
      await tx.cobranca.update({ where: { id: cobranca.id }, data: { statusPagamento: 'PAGO' } });
      await this.saldo.recalcularLocacao(tx, cobranca.locacaoId);
    });
    return { status: 'approved', registrado: true };
  }
}
