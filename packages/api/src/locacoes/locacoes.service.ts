import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';
import { UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';
import { CriarLocacaoDto, RegraDto } from './dto/criar-locacao.dto';
import { FinalizarLocacaoDto, TipoFinalizacaoDto } from './dto/finalizar-locacao.dto';

interface ListarLocacoesFiltros {
  clienteId?: string;
  status?: string;
  pagina?: number;
  limite?: number;
}

@Injectable()
export class LocacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /* ─── LISTAGEM COM FILTROS ─── */
  async listar(filtros: ListarLocacoesFiltros) {
    const { clienteId, status, pagina = 1, limite = 20 } = filtros;
    const where: Prisma.LocacaoWhereInput = { deletedAt: null };
    if (clienteId) where.clienteId = clienteId;
    if (status) where.status = status as any;

    const [itens, total] = await Promise.all([
      this.prisma.locacao.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true } },
          produto: { select: { id: true, plaqueta: true, descricao: true } },
          endereco: { select: { id: true, logradouro: true, numero: true, bairro: true, cidade: true } },
        },
        orderBy: { dataInicio: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      this.prisma.locacao.count({ where }),
    ]);

    return { itens, total, pagina, limite };
  }

  /* ─── DETALHE COM COBRANÇAS E PAGAMENTOS ─── */
  async obter(id: string) {
    const locacao = await this.prisma.locacao.findFirst({
      where: { id, deletedAt: null },
      include: {
        cliente: { select: { id: true, nome: true, cpfCnpj: true, telefones: true } },
        produto: { select: { id: true, plaqueta: true, descricao: true, contador: true } },
        endereco: { select: { id: true, logradouro: true, numero: true, bairro: true, cidade: true, estado: true, cep: true } },
        deposito: { select: { id: true, nome: true } },
        cobrancas: {
          where: { deletedAt: null },
          orderBy: { dataCobranca: 'desc' },
          take: 10,
          include: {
            usuario: { select: { id: true, nome: true } },
            pagamentos: { where: { deletedAt: null, estornadoPorId: null }, orderBy: { dataPagamento: 'desc' } },
          },
        },
        saldos: { where: { deletedAt: null } },
      },
    });
    if (!locacao) throw new NotFoundException('Locação não encontrada.');
    return locacao;
  }

  async criar(u: UsuarioRequisicao, dto: CriarLocacaoDto, ip?: string) {
    const produto = await this.prisma.produto.findFirst({ where: { id: dto.produtoId, deletedAt: null } });
    if (!produto) throw new NotFoundException('Produto não encontrado.');

    // contador inicial = leitura informada ou contador atual do produto
    const contadorInicial = dto.contadorInicial ?? produto.contador;

    try {
      const criada = await this.prisma.locacao.create({
        data: {
          produtoId: dto.produtoId,
          clienteId: dto.clienteId,
          enderecoId: dto.enderecoId,
          regra: dto.regra,
          frequencia: dto.regra === RegraDto.VALOR_FIXO ? (dto.frequencia as any) : null,
          valorFixo: dto.regra === RegraDto.VALOR_FIXO ? dto.valorFixo : null,
          valorPartida: dto.regra !== RegraDto.VALOR_FIXO ? dto.valorPartida : null,
          percentual: dto.regra !== RegraDto.VALOR_FIXO ? dto.percentual : null,
          contadorInicial,
          dataInicio: new Date(),
          status: 'ATIVA',
          saldoDevedorAtual: 0,
          // [AUDIT P1] trava de uma locação ATIVA por produto
          chaveProdutoAtivo: dto.produtoId,
        },
      });
      await this.auditoria.registrar({ usuarioId: u.id, acao: 'CRIAR', entidade: 'Locacao', entidadeId: criada.id, dadosNovos: criada, ip });
      return criada;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Este produto já possui uma locação ativa.');
      }
      throw e;
    }
  }

  async finalizar(u: UsuarioRequisicao, id: string, dto: FinalizarLocacaoDto, ip?: string) {
    const locacao = await this.prisma.locacao.findFirst({
      where: { id, deletedAt: null }, include: { produto: true },
    });
    if (!locacao) throw new NotFoundException('Locação não encontrada.');
    if (locacao.status === 'FINALIZADA') throw new BadRequestException('Locação já finalizada.');
    if (dto.tipo === TipoFinalizacaoDto.DEPOSITO && !dto.depositoId)
      throw new BadRequestException('Informe o depósito.');
    if (dto.tipo === TipoFinalizacaoDto.RELOCACAO && !dto.novaLocacao)
      throw new BadRequestException('Informe os dados da nova locação (relocação).');

    // [AUDIT P1] permissão depende do tipo de finalização — validada no servidor.
    const permNecessaria = dto.tipo === TipoFinalizacaoDto.DEPOSITO
      ? 'locacoes.finalizar_deposito'
      : 'locacoes.finalizar_relocacao';
    if (!u.permissoes.includes(permNecessaria)) {
      throw new ForbiddenException(`Permissão necessária: ${permNecessaria}`);
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1) Encerra a locação e LIBERA o produto (chaveProdutoAtivo = null).
      const finalizada = await tx.locacao.update({
        where: { id },
        data: {
          status: 'FINALIZADA',
          dataFim: new Date(),
          finalizacaoTipo: dto.tipo,
          depositoId: dto.tipo === TipoFinalizacaoDto.DEPOSITO ? dto.depositoId : null,
          chaveProdutoAtivo: null,
          version: { increment: 1 },
        },
      });

      // 2) Saldo pendente vira registro independente, vinculado ao cliente.
      const saldo = locacao.saldoDevedorAtual;
      if (!saldo.equals(0)) {
        await tx.saldoDevedorLocacao.create({
          data: {
            locacaoId: locacao.id,
            clienteId: locacao.clienteId,
            produtoDescricao: `${locacao.produto.plaqueta} ${locacao.produto.descricao ?? ''}`.trim(),
            valorOriginal: saldo,
            valorRestante: saldo,
            status: 'PENDENTE',
          },
        });
      }

      // 3) Relocação: abre nova locação do MESMO produto para o novo cliente.
      let novaLocacaoId: string | null = null;
      if (dto.tipo === TipoFinalizacaoDto.RELOCACAO && dto.novaLocacao) {
        const nova = await tx.locacao.create({
          data: {
            produtoId: locacao.produtoId,
            clienteId: dto.novaLocacao.clienteId,
            enderecoId: dto.novaLocacao.enderecoId,
            regra: locacao.regra,
            frequencia: locacao.frequencia,
            valorFixo: locacao.valorFixo,
            valorPartida: locacao.valorPartida,
            percentual: locacao.percentual,
            contadorInicial: locacao.produto.contador,
            dataInicio: new Date(),
            status: 'ATIVA',
            saldoDevedorAtual: 0,
            chaveProdutoAtivo: locacao.produtoId,
          },
        });
        novaLocacaoId = nova.id;
        await tx.locacao.update({ where: { id }, data: { relocadaParaId: nova.id } });
      }

      await this.auditoria.registrar({
        usuarioId: u.id, acao: 'FINALIZAR', entidade: 'Locacao', entidadeId: id,
        dadosAnteriores: locacao, dadosNovos: { ...finalizada, novaLocacaoId }, ip,
      });
      return { ...finalizada, novaLocacaoId };
    });
  }

  listarAtivasDoCliente(clienteId: string) {
    return this.prisma.locacao.findMany({
      where: { clienteId, status: 'ATIVA', deletedAt: null },
      include: { produto: true, endereco: true },
    });
  }

  /**
   * Contexto para registrar/pré-visualizar uma cobrança: referência (última
   * cobrança ou início), contador anterior e saldo atual. Usado pelo painel
   * para pré-visualizar com o mesmo motor do @app/core.
   */
  async contextoCobranca(id: string) {
    const locacao = await this.prisma.locacao.findFirst({
      where: { id, deletedAt: null }, include: { produto: true },
    });
    if (!locacao) throw new NotFoundException('Locação não encontrada.');
    const ultima = await this.prisma.cobranca.findFirst({
      where: { locacaoId: id, deletedAt: null }, orderBy: { dataCobranca: 'desc' },
    });
    return {
      locacao,
      dataReferencia: (ultima?.dataCobranca ?? locacao.dataInicio).toISOString(),
      contadorAnterior: ultima?.contadorAtual ?? locacao.contadorInicial,
      saldoAnterior: locacao.saldoDevedorAtual.toString(),
    };
  }
}
