import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSOES, PAPEIS } from '../permissoes.catalog';

/**
 * Sincroniza o catálogo de permissões com o banco e garante que
 * todos os usuários com papel "Administrador" possuam TODAS as permissões.
 * Roda automaticamente na inicialização (onModuleInit).
 */
@Injectable()
export class PermissoesSeedService implements OnModuleInit {
  private readonly logger = new Logger(PermissoesSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.sincronizar();
    } catch (erro: any) {
      this.logger.warn('Falha ao sincronizar permissões (não bloqueia startup): ' + (erro?.message ?? String(erro)));
    }
  }

  private async sincronizar() {
    // 1) Upsert de todas as permissões do catálogo
    for (const p of PERMISSOES) {
      await this.prisma.permissao.upsert({
        where: { chave: p.chave },
        update: { descricao: p.descricao },
        create: p,
      });
    }

    // 2) Buscar IDs de todas as permissões que o Administrador deve ter
    const chavesAdmin = PAPEIS.Administrador;
    const permissoesAdmin = await this.prisma.permissao.findMany({
      where: { chave: { in: chavesAdmin } },
      select: { id: true, chave: true },
    });

    // 3) Buscar todos os usuários que já possuem ao menos uma permissão de admin
    //    e sincronizar com o papel completo
    const todosUsuarios = await this.prisma.usuario.findMany({
      where: { ativo: true, deletedAt: null },
      include: { permissoes: { include: { permissao: true } } },
    });

    const idsAdmin = permissoesAdmin.map((p) => p.id);

    // Identifica admins: têm a permissão 'admin.permissoes.atribuir' ou são o admin padrão
    const adminPadraoCpf = process.env.ADMIN_CPF ?? '00000000000';
    const admins = todosUsuarios.filter((u) => {
      const chavesUsuario = new Set(u.permissoes.map((p) => p.permissao.chave));
      return chavesUsuario.has('admin.permissoes.atribuir') || u.cpf === adminPadraoCpf;
    });

    // 4) Para cada admin, adicionar permissões que faltam
    let totalNovas = 0;
    for (const admin of admins) {
      const idsExistentes = new Set(admin.permissoes.map((p) => p.permissaoId));
      const faltando = permissoesAdmin.filter((p) => !idsExistentes.has(p.id));

      if (faltando.length > 0) {
        await this.prisma.usuarioPermissao.createMany({
          data: faltando.map((p) => ({ usuarioId: admin.id, permissaoId: p.id })),
          skipDuplicates: true,
        });
        totalNovas += faltando.length;
        this.logger.log(`+${faltando.length} permissões adicionadas ao usuário ${admin.nome} (${admin.id})`);
      }
    }

    if (totalNovas > 0) {
      this.logger.log(`Sincronização concluída: ${totalNovas} permissões adicionadas no total.`);
    } else {
      this.logger.verbose('Todas as permissões já estavam sincronizadas.');
    }
  }
}
