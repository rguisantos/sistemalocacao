import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';
import { UsuarioRequisicao } from '../comum/decorators/usuario-atual.decorator';
import { PAPEIS, PERMISSOES } from '../comum/permissoes.catalog';
import { CriarUsuarioDto, AtualizarUsuarioDto, DefinirPermissoesDto } from './dto/usuario.dto';

// Projeção segura: nunca expõe senha/tokenVersao.
const SEM_SENHA = {
  id: true, nome: true, cpf: true, ativo: true, pushToken: true,
  createdAt: true, updatedAt: true, version: true,
  rotas: { select: { rotaId: true } },
  permissoes: { select: { permissao: { select: { chave: true } } } },
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService, private readonly auditoria: AuditoriaService) {}

  /** Expande papel + chaves explícitas em IDs de Permissao existentes. */
  private async resolverPermissaoIds(papel?: string, chaves?: string[]): Promise<string[]> {
    const conjunto = new Set<string>(chaves ?? []);
    if (papel) {
      const preset = PAPEIS[papel];
      if (!preset) throw new BadRequestException(`Papel desconhecido: ${papel}`);
      preset.forEach((c) => conjunto.add(c));
    }
    if (conjunto.size === 0) return [];
    const permissoes = await this.prisma.permissao.findMany({
      where: { chave: { in: [...conjunto] } }, select: { id: true },
    });
    return permissoes.map((p) => p.id);
  }

  private async hash(senha: string) {
    return argon2.hash(senha, { type: argon2.argon2id });
  }

  listar() { return this.prisma.usuario.findMany({ where: { deletedAt: null }, select: SEM_SENHA, orderBy: { nome: 'asc' } }); }

  /** Catálogo de permissões (agrupável por módulo) + papéis-preset, para a UI de atribuição. */
  catalogo() {
    return { permissoes: PERMISSOES, papeis: PAPEIS };
  }

  async obter(id: string) {
    const u = await this.prisma.usuario.findFirst({ where: { id, deletedAt: null }, select: SEM_SENHA });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    return u;
  }

  async criar(atual: UsuarioRequisicao, dto: CriarUsuarioDto, ip?: string) {
    const senhaHash = await this.hash(dto.senha);
    const permissaoIds = await this.resolverPermissaoIds(dto.papel, dto.permissoes);
    try {
      const criado = await this.prisma.usuario.create({
        data: {
          nome: dto.nome, cpf: dto.cpf, senha: senhaHash, ativo: dto.ativo ?? true,
          rotas: { create: (dto.rotaIds ?? []).map((rotaId) => ({ rotaId })) },
          permissoes: { create: permissaoIds.map((permissaoId) => ({ permissaoId })) },
        },
        select: SEM_SENHA,
      });
      await this.auditoria.registrar({ usuarioId: atual.id, acao: 'CRIAR', entidade: 'Usuario', entidadeId: (criado as any).id, dadosNovos: criado, ip });
      return criado;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe um usuário com este CPF.');
      }
      throw e;
    }
  }

  async atualizar(atual: UsuarioRequisicao, id: string, dto: AtualizarUsuarioDto, ip?: string) {
    await this.obter(id);
    const data: Prisma.UsuarioUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;
    // Reset de senha revoga sessões (incrementa tokenVersao) — decisão da auditoria P0.
    if (dto.novaSenha) { data.senha = await this.hash(dto.novaSenha); data.tokenVersao = { increment: 1 }; }

    const r = await this.prisma.usuario.updateMany({ where: { id, version: dto.version }, data: { ...data, version: { increment: 1 } } });
    if (r.count === 0) throw new ConflictException('Usuário alterado por outra fonte. Recarregue.');

    if (dto.rotaIds) {
      await this.prisma.$transaction([
        this.prisma.usuarioRota.deleteMany({ where: { usuarioId: id } }),
        this.prisma.usuarioRota.createMany({ data: dto.rotaIds.map((rotaId) => ({ usuarioId: id, rotaId })) }),
      ]);
    }
    const novo = await this.obter(id);
    await this.auditoria.registrar({ usuarioId: atual.id, acao: 'ATUALIZAR', entidade: 'Usuario', entidadeId: id, dadosNovos: novo, ip });
    return novo;
  }

  /** Substitui o conjunto de permissões (papel preset e/ou chaves). */
  async definirPermissoes(atual: UsuarioRequisicao, id: string, dto: DefinirPermissoesDto, ip?: string) {
    await this.obter(id);
    const permissaoIds = await this.resolverPermissaoIds(dto.papel, dto.permissoes);
    await this.prisma.$transaction([
      this.prisma.usuarioPermissao.deleteMany({ where: { usuarioId: id } }),
      this.prisma.usuarioPermissao.createMany({ data: permissaoIds.map((permissaoId) => ({ usuarioId: id, permissaoId })) }),
      // troca de permissões revoga tokens antigos (carregam permissões no payload)
      this.prisma.usuario.update({ where: { id }, data: { tokenVersao: { increment: 1 } } }),
    ]);
    const novo = await this.obter(id);
    await this.auditoria.registrar({ usuarioId: atual.id, acao: 'DEFINIR_PERMISSOES', entidade: 'Usuario', entidadeId: id, dadosNovos: novo, ip });
    return novo;
  }

  async remover(atual: UsuarioRequisicao, id: string, ip?: string) {
    const anterior = await this.obter(id);
    // soft-delete + revoga sessões
    await this.prisma.usuario.update({ where: { id }, data: { deletedAt: new Date(), ativo: false, tokenVersao: { increment: 1 } } });
    await this.auditoria.registrar({ usuarioId: atual.id, acao: 'EXCLUIR', entidade: 'Usuario', entidadeId: id, dadosAnteriores: anterior, ip });
    return { id, removido: true };
  }
}
