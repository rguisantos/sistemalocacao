import { Injectable } from '@nestjs/common';
import { CadastroCrudService } from '../comum/crud/cadastro-crud.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../comum/auditoria/auditoria.service';

@Injectable()
export class DepositosService extends CadastroCrudService {
  protected nomeDelegate = 'deposito';
  protected entidade = 'Deposito';
  constructor(prisma: PrismaService, auditoria: AuditoriaService) { super(prisma, auditoria); }
}
