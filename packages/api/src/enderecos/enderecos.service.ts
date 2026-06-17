import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';
import { UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';
import { CriarEnderecoDto, AtualizarEnderecoDto } from './dto/endereco.dto';

/**
 * Endereços herdam o isolamento por rota do cliente (anti-IDOR — P1):
 * só gerencia endereço de cliente que o usuário pode acessar.
 */
@Injectable()
export class EnderecosService {
  constructor(private readonly prisma: PrismaService, private readonly auditoria: AuditoriaService) {}

  private async garantirAcessoCliente(u: UsuarioRequisicao, clienteId: string) {
    if (u.permissoes.includes('clientes.ler_todas_rotas')) return;
    const rotas = await this.prisma.usuarioRota.findMany({ where: { usuarioId: u.id }, select: { rotaId: true } });
    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, deletedAt: null } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    if (!rotas.map((r) => r.rotaId).includes(cliente.rotaId)) {
      throw new ForbiddenException('Cliente fora das suas rotas.');
    }
  }

  async listarDoCliente(u: UsuarioRequisicao, clienteId: string) {
    await this.garantirAcessoCliente(u, clienteId);
    return this.prisma.endereco.findMany({ where: { clienteId, deletedAt: null } });
  }

  async criar(u: UsuarioRequisicao, dto: CriarEnderecoDto, ip?: string) {
    await this.garantirAcessoCliente(u, dto.clienteId);
    const criado = await this.prisma.endereco.create({ data: { ...dto } });
    await this.auditoria.registrar({ usuarioId: u.id, acao: 'CRIAR', entidade: 'Endereco', entidadeId: criado.id, dadosNovos: criado, ip });
    return criado;
  }

  async atualizar(u: UsuarioRequisicao, id: string, dto: AtualizarEnderecoDto, ip?: string) {
    const atual = await this.prisma.endereco.findFirst({ where: { id, deletedAt: null } });
    if (!atual) throw new NotFoundException('Endereço não encontrado.');
    await this.garantirAcessoCliente(u, atual.clienteId);
    const { version, ...dados } = dto;
    const r = await this.prisma.endereco.updateMany({ where: { id, version }, data: { ...dados, version: { increment: 1 } } });
    if (r.count === 0) throw new ConflictException('Endereço alterado por outra fonte. Recarregue.');
    const novo = await this.prisma.endereco.findUnique({ where: { id } });
    await this.auditoria.registrar({ usuarioId: u.id, acao: 'ATUALIZAR', entidade: 'Endereco', entidadeId: id, dadosAnteriores: atual, dadosNovos: novo, ip });
    return novo;
  }

  async remover(u: UsuarioRequisicao, id: string, ip?: string) {
    const atual = await this.prisma.endereco.findFirst({ where: { id, deletedAt: null } });
    if (!atual) throw new NotFoundException('Endereço não encontrado.');
    await this.garantirAcessoCliente(u, atual.clienteId);
    await this.prisma.endereco.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditoria.registrar({ usuarioId: u.id, acao: 'EXCLUIR', entidade: 'Endereco', entidadeId: id, dadosAnteriores: atual, ip });
    return { id, removido: true };
  }
}
