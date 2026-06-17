import { Injectable } from '@nestjs/common';
import { CadastroCrudService } from '../comum/crud/cadastro-crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';

@Injectable()
export class RotasService extends CadastroCrudService {
  protected nomeDelegate = 'rota';
  protected entidade = 'Rota';
  constructor(prisma: PrismaService, auditoria: AuditoriaService) { super(prisma, auditoria); }
}
