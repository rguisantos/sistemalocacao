import { IsEnum, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoFinalizacaoDto { DEPOSITO = 'DEPOSITO', RELOCACAO = 'RELOCACAO' }

class NovaLocacaoDto {
  @IsUUID() clienteId: string;
  @IsUUID() enderecoId: string;
}

export class FinalizarLocacaoDto {
  @IsEnum(TipoFinalizacaoDto) tipo: TipoFinalizacaoDto;
  @IsOptional() @IsUUID() depositoId?: string;           // se DEPOSITO
  @IsOptional() @ValidateNested() @Type(() => NovaLocacaoDto)
  novaLocacao?: NovaLocacaoDto;                           // se RELOCACAO
}
