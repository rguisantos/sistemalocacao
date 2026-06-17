import { Injectable } from '@nestjs/common';
import { CadastroCrudService } from '../comum/crud/cadastro-crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';

@Injectable()
export class TiposProdutoService extends CadastroCrudService {
  protected nomeDelegate = 'tipoProduto'; protected entidade = 'TipoProduto'; protected ordenarPor = 'nome';
  constructor(prisma: PrismaService, auditoria: AuditoriaService) { super(prisma, auditoria); }
}
@Injectable()
export class TamanhosService extends CadastroCrudService {
  protected nomeDelegate = 'tamanho'; protected entidade = 'Tamanho'; protected ordenarPor = 'descricao';
  constructor(prisma: PrismaService, auditoria: AuditoriaService) { super(prisma, auditoria); }
}
@Injectable()
export class CondicoesService extends CadastroCrudService {
  protected nomeDelegate = 'condicao'; protected entidade = 'Condicao'; protected ordenarPor = 'descricao';
  constructor(prisma: PrismaService, auditoria: AuditoriaService) { super(prisma, auditoria); }
}
