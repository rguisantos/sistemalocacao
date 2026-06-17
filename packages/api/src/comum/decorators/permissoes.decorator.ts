import { SetMetadata } from '@nestjs/common';
/**
 * Exige uma ou mais permissões (validadas NO SERVIDOR — decisão da auditoria P1).
 * Ex.: @RequerPermissoes('clientes.criar')
 */
export const PERMISSOES = 'permissoes';
export const RequerPermissoes = (...chaves: string[]) => SetMetadata(PERMISSOES, chaves);
