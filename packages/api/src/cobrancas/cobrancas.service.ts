import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  calcularValorFixo, calcularPercentual, aplicarPagamento, menorQue,
} from '@app/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';
import { SaldoService } from './saldo.service';
import { UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';
import { RegistrarCobrancaDto } from './dto/registrar-cobranca.dto';

@Injectable()
export class CobrancasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly saldo: SaldoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async registrar(u: UsuarioRequisicao, dto: RegistrarCobrancaDto, ip?: string) {
    // Idempotência: se o id do cliente já existe, devolve a cobrança existente.
    if (dto.id) {
      const existente = await this.prisma.cobranca.findUnique({ where: { id: dto.id } });
      if (existente) return { cobranca: existente, idempotente: true };
    }

    const locacao = await this.prisma.locacao.findFirst({
      where: { id: dto.locacaoId, deletedAt: null }, include: { produto: true },
    });
    if (!locacao) throw new NotFoundException('Locação não encontrada.');
    if (locacao.status === 'FINALIZADA') throw new BadRequestException('Locação finalizada não pode ser cobrada.');

    const ultima = await this.prisma.cobranca.findFirst({
      where: { locacaoId: locacao.id, deletedAt: null }, orderBy: { dataCobranca: 'desc' },
    });
    const dataReferencia = ultima?.dataCobranca ?? locacao.dataInicio;
    const contadorAnterior = ultima?.contadorAtual ?? locacao.contadorInicial;
    const saldoAnterior = locacao.saldoDevedorAtual.toString();
    const hoje = dto.dataCobranca ? new Date(dto.dataCobranca) : new Date();
    const acrescimo = dto.acrescimo ?? 0;

    // ---- cálculo via @app/core ----
    let calc: ReturnType<typeof calcularValorFixo> | ReturnType<typeof calcularPercentual>;
    let dadosPercentual: { contadorAtual: number; partidasJogadas: number; partidasConsideradas: number } | null = null;

    if (locacao.regra === 'VALOR_FIXO') {
      calc = calcularValorFixo({
        valorFixo: locacao.valorFixo!.toString(),
        frequencia: locacao.frequencia as any,
        dataReferencia, hoje, acrescimo, saldoAnterior,
      });
    } else {
      if (dto.contadorAtual == null) throw new BadRequestException('Informe o contador atual.');
      const r = calcularPercentual({
        regra: locacao.regra as any,
        contadorAnterior,
        contadorAtual: dto.contadorAtual,
        contadorReiniciado: dto.contadorReiniciado,
        valorPartida: locacao.valorPartida!.toString(),
        percentual: locacao.percentual!.toString(),
        descontoPartidas: dto.descontoPartidas,
        acrescimo,
        descontoValorReceber: dto.descontoValorReceber,
        saldoAnterior,
      });
      calc = r;
      dadosPercentual = { contadorAtual: dto.contadorAtual, partidasJogadas: r.partidasJogadas, partidasConsideradas: r.partidasConsideradas };
    }

    const valorPago = dto.pagamento?.valor ?? 0;
    const { alertaPagamentoInferior } = aplicarPagamento(locacao.regra as any, calc.valorLiquidoFinal.toString(), valorPago);

    const statusPagamento = valorPago <= 0
      ? 'PENDENTE'
      : (menorQue(valorPago, calc.valorLiquidoFinal.toString()) ? 'PARCIAL' : 'PAGO');

    const podeTrocaPano = u.permissoes.includes('cobrancas.marcar_troca_pano');
    const trocaPano = !!dto.trocaPano && podeTrocaPano;

    // ---- persistência transacional ----
    const resultado = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const cobranca = await tx.cobranca.create({
        data: {
          id: dto.id,                                    // idempotência por UUID do cliente
          locacaoId: locacao.id,
          usuarioId: u.id,
          dataCobranca: hoje,
          regraSnapshot: locacao.regra,                  // [AUDIT P1] snapshot reproduzível
          regraVersaoSnapshot: locacao.regraVersao,
          contadorAnterior: dadosPercentual ? contadorAnterior : null,
          contadorAtual: dadosPercentual?.contadorAtual ?? null,
          contadorReiniciado: !!dto.contadorReiniciado,
          partidasJogadas: dadosPercentual?.partidasJogadas ?? null,
          descontoPartidas: dto.descontoPartidas ?? 0,
          partidasConsideradas: dadosPercentual?.partidasConsideradas ?? null,
          acrescimo: Number(acrescimo).toFixed(2),
          valorBruto: calc.valorBruto?.toFixed(2) ?? null,
          valorPercentual: calc.valorPercentual?.toFixed(2) ?? null,
          descontoValorReceber: (dto.descontoValorReceber ?? 0).toFixed(2),
          valorLiquidoBase: calc.valorLiquidoBase.toFixed(2),
          saldoDevedorAnterior: calc.saldoDevedorAnterior.toFixed(2),
          valorLiquidoFinal: calc.valorLiquidoFinal.toFixed(2),
          trocaPano,
          statusPagamento,
        },
      });

      // Pagamento append-only (decisão da auditoria — P0)
      if (dto.pagamento && valorPago > 0) {
        await tx.pagamento.create({
          data: {
            alvo: 'COBRANCA', cobrancaId: cobranca.id, usuarioId: u.id,
            valor: valorPago.toFixed(2), formaPagamento: dto.pagamento.formaPagamento,
            pixId: dto.pagamento.pixId, dataPagamento: hoje,
          },
        });
      }

      // Troca de pano gera manutenção vinculada (seção 11 da spec)
      if (trocaPano) {
        await tx.manutencao.create({
          data: { produtoId: locacao.produtoId, cobrancaId: cobranca.id, usuarioId: u.id, tipo: 'TROCA_PANO', data: hoje },
        });
      }

      // Atualiza o contador do produto (percentual)
      if (dadosPercentual) {
        await tx.produto.update({ where: { id: locacao.produtoId }, data: { contador: dadosPercentual.contadorAtual } });
      }

      // Saldo derivado do histórico (nunca do cliente)
      const novoSaldo = await this.saldo.recalcularLocacao(tx, locacao.id);
      return { cobranca, novoSaldo };
    });

    await this.auditoria.registrar({
      usuarioId: u.id, acao: 'REGISTRAR_COBRANCA', entidade: 'Cobranca',
      entidadeId: resultado.cobranca.id, dadosNovos: resultado.cobranca, ip,
    });

    return {
      cobranca: resultado.cobranca,
      memorial: calc.memorial,
      saldoAtualizado: resultado.novoSaldo,
      alertaPagamentoInferior,
    };
  }
}
