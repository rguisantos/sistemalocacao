import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';
import { UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';
import { CriarClienteDto } from './dto/criar-cliente.dto';
import { AtualizarClienteDto } from './dto/atualizar-cliente.dto';

const VER_TODAS = 'clientes.ler_todas_rotas';

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Rotas do usuário — base do isolamento anti-IDOR (decisão da auditoria — P1). */
  private async rotasDoUsuario(usuarioId: string): Promise<string[]> {
    const vinculos = await this.prisma.usuarioRota.findMany({
      where: { usuarioId }, select: { rotaId: true },
    });
    return vinculos.map((v) => v.rotaId);
  }

  private podeVerTodas(u: UsuarioRequisicao) { return u.permissoes.includes(VER_TODAS); }

  async listar(u: UsuarioRequisicao) {
    // Sem a permissão global, restringe às rotas do usuário — NO SERVIDOR.
    const where = this.podeVerTodas(u)
      ? { deletedAt: null }
      : { deletedAt: null, rotaId: { in: await this.rotasDoUsuario(u.id) } };
    return this.prisma.cliente.findMany({ where, orderBy: { nome: 'asc' } });
  }

  /** Pontos para o mapa: clientes com endereços geolocalizados, numa única query, escopado por rota. */
  async mapa(u: UsuarioRequisicao) {
    const where: any = this.podeVerTodas(u)
      ? { deletedAt: null }
      : { deletedAt: null, rotaId: { in: await this.rotasDoUsuario(u.id) } };
    const clientes = await this.prisma.cliente.findMany({
      where,
      select: {
        nome: true,
        enderecos: {
          where: { deletedAt: null, latitude: { not: null }, longitude: { not: null } },
          select: { logradouro: true, latitude: true, longitude: true },
        },
      },
    });
    return clientes.flatMap((c) =>
      c.enderecos.map((e) => ({ nome: c.nome, lat: e.latitude as number, lng: e.longitude as number, detalhe: e.logradouro })),
    );
  }

  async obter(u: UsuarioRequisicao, id: string) {
    const cliente = await this.prisma.cliente.findFirst({ where: { id, deletedAt: null } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    if (!this.podeVerTodas(u)) {
      const rotas = await this.rotasDoUsuario(u.id);
      if (!rotas.includes(cliente.rotaId)) {
        // Anti-IDOR: não vaza nem a existência do registro de outra rota.
        throw new NotFoundException('Cliente não encontrado.');
      }
    }
    return cliente;
  }

  async criar(u: UsuarioRequisicao, dto: CriarClienteDto, ip?: string) {
    if (!this.podeVerTodas(u)) {
      const rotas = await this.rotasDoUsuario(u.id);
      if (!rotas.includes(dto.rotaId)) {
        throw new ForbiddenException('Você não pode cadastrar cliente fora das suas rotas.');
      }
    }
    const { endereco, ...dadosCliente } = dto;
    const criado = await this.prisma.cliente.create({
      // o endereço é cadastrado junto do cliente, na mesma transação (nested create)
      data: {
        ...dadosCliente,
        telefones: dadosCliente.telefones ?? [],
        enderecos: endereco ? { create: [endereco] } : undefined,
      },
      include: { enderecos: true },
    });
    await this.auditoria.registrar({
      usuarioId: u.id, acao: 'CRIAR', entidade: 'Cliente', entidadeId: criado.id, dadosNovos: criado, ip,
    });
    return criado;
  }

  async atualizar(u: UsuarioRequisicao, id: string, dto: AtualizarClienteDto, ip?: string) {
    const atual = await this.obter(u, id); // já valida rota
    const { version, ...dados } = dto;

    // Concorrência otimista: só atualiza se a versão bater (incrementa atomicamente).
    const resultado = await this.prisma.cliente.updateMany({
      where: { id, version },
      data: { ...dados, version: { increment: 1 } },
    });
    if (resultado.count === 0) {
      throw new ConflictException('Registro foi alterado por outra fonte. Recarregue e tente novamente.');
    }
    const novo = await this.prisma.cliente.findUnique({ where: { id } });
    await this.auditoria.registrar({
      usuarioId: u.id, acao: 'ATUALIZAR', entidade: 'Cliente', entidadeId: id,
      dadosAnteriores: atual, dadosNovos: novo, ip,
    });
    return novo;
  }

  async remover(u: UsuarioRequisicao, id: string, ip?: string) {
    const atual = await this.obter(u, id);
    // Soft-delete (decisão da auditoria — P0): vira tombstone no sync.
    await this.prisma.cliente.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditoria.registrar({
      usuarioId: u.id, acao: 'EXCLUIR', entidade: 'Cliente', entidadeId: id, dadosAnteriores: atual, ip,
    });
    return { id, removido: true };
  }

  /** Transferência de rota — permissão dedicada (clientes.transferir_rota). */
  async transferirRota(u: UsuarioRequisicao, id: string, novaRotaId: string, version: number, ip?: string) {
    const atual = await this.obter(u, id); // valida acesso à rota de origem
    const r = await this.prisma.cliente.updateMany({
      where: { id, version }, data: { rotaId: novaRotaId, version: { increment: 1 } },
    });
    if (r.count === 0) throw new ConflictException('Cliente alterado por outra fonte. Recarregue.');
    const novo = await this.prisma.cliente.findUnique({ where: { id } });
    await this.auditoria.registrar({
      usuarioId: u.id, acao: 'TRANSFERIR_ROTA', entidade: 'Cliente', entidadeId: id,
      dadosAnteriores: { rotaId: atual.rotaId }, dadosNovos: { rotaId: novaRotaId }, ip,
    });
    return novo;
  }
}
