import { NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioRequisicao } from '../decorators/usuario-atual.decorator';

/**
 * CRUD genérico para cadastros simples (rotas, depósitos, tipos, tamanhos, condições).
 * Padroniza soft-delete (tombstone do sync), auditoria e concorrência otimista (version),
 * eliminando repetição. Subclasses só informam o delegate, o nome da entidade e a ordenação.
 */
export abstract class CadastroCrudService {
  protected abstract nomeDelegate: string; // ex.: 'rota'
  protected abstract entidade: string;      // ex.: 'Rota'
  protected ordenarPor = 'nome';

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly auditoria: AuditoriaService,
  ) {}

  private get d(): any { return (this.prisma as any)[this.nomeDelegate]; }

  listar() {
    return this.d.findMany({ where: { deletedAt: null }, orderBy: { [this.ordenarPor]: 'asc' } });
  }

  async obter(id: string) {
    const reg = await this.d.findFirst({ where: { id, deletedAt: null } });
    if (!reg) throw new NotFoundException(`${this.entidade} não encontrado(a).`);
    return reg;
  }

  async criar(u: UsuarioRequisicao, dados: Record<string, unknown>, ip?: string) {
    const criado = await this.d.create({ data: dados });
    await this.auditoria.registrar({
      usuarioId: u.id, acao: 'CRIAR', entidade: this.entidade, entidadeId: criado.id, dadosNovos: criado, ip,
    });
    return criado;
  }

  async atualizar(u: UsuarioRequisicao, id: string, dados: Record<string, unknown>, version: number, ip?: string) {
    const atual = await this.obter(id);
    const r = await this.d.updateMany({
      where: { id, version }, data: { ...dados, version: { increment: 1 } },
    });
    if (r.count === 0) {
      throw new ConflictException('Registro alterado por outra fonte. Recarregue e tente novamente.');
    }
    const novo = await this.d.findUnique({ where: { id } });
    await this.auditoria.registrar({
      usuarioId: u.id, acao: 'ATUALIZAR', entidade: this.entidade, entidadeId: id,
      dadosAnteriores: atual, dadosNovos: novo, ip,
    });
    return novo;
  }

  async remover(u: UsuarioRequisicao, id: string, ip?: string) {
    const atual = await this.obter(id);
    await this.d.update({ where: { id }, data: { deletedAt: new Date() } }); // soft-delete = tombstone
    await this.auditoria.registrar({
      usuarioId: u.id, acao: 'EXCLUIR', entidade: this.entidade, entidadeId: id, dadosAnteriores: atual, ip,
    });
    return { id, removido: true };
  }
}
