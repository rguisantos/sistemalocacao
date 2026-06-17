import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CadastroCrudService } from '../comum/crud/cadastro-crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';
import { UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';

@Injectable()
export class ProdutosService extends CadastroCrudService {
  protected nomeDelegate = 'produto';
  protected entidade = 'Produto';
  protected ordenarPor = 'plaqueta';
  constructor(prisma: PrismaService, auditoria: AuditoriaService) { super(prisma, auditoria); }

  // plaqueta é única — traduz erro do banco em mensagem amigável.
  async criar(u: UsuarioRequisicao, dados: Record<string, unknown>, ip?: string) {
    try { return await super.criar(u, dados, ip); }
    catch (e) { throw this.tratarUnico(e); }
  }
  async atualizar(u: UsuarioRequisicao, id: string, dados: Record<string, unknown>, version: number, ip?: string) {
    try { return await super.atualizar(u, id, dados, version, ip); }
    catch (e) { throw this.tratarUnico(e); }
  }
  private tratarUnico(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('Já existe um produto com esta plaqueta.');
    }
    return e as Error;
  }

  /** Alteração de contador é ação privilegiada e auditada (permissão dedicada). */
  async alterarContador(u: UsuarioRequisicao, id: string, contador: number, version: number, ip?: string) {
    const atual = await this.obter(id);
    const r = await this.prisma.produto.updateMany({
      where: { id, version }, data: { contador, version: { increment: 1 } },
    });
    if (r.count === 0) throw new ConflictException('Produto alterado por outra fonte. Recarregue.');
    const novo = await this.prisma.produto.findUnique({ where: { id } });
    await this.auditoria.registrar({
      usuarioId: u.id, acao: 'ALTERAR_CONTADOR', entidade: 'Produto', entidadeId: id,
      dadosAnteriores: { contador: atual.contador }, dadosNovos: { contador }, ip,
    });
    return novo;
  }

  /** Produtos em depósito: sem locação ativa e com finalização anterior para depósito. */
  listarEmDeposito() {
    return this.prisma.produto.findMany({
      where: {
        deletedAt: null,
        locacoes: {
          none: { status: 'ATIVA', deletedAt: null },                      // não está locado
        },
        AND: { locacoes: { some: { finalizacaoTipo: 'DEPOSITO' } } },        // último destino foi depósito
      },
      orderBy: { plaqueta: 'asc' },
    });
  }
}
