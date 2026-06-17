import { IsInt, IsOptional, IsString, IsUUID, Length, IsArray } from 'class-validator';

export class AtualizarClienteDto {
  @IsOptional() @IsString() @Length(2, 200) nome?: string;
  @IsOptional() @IsString() rgIe?: string;
  @IsOptional() @IsArray() telefones?: string[];
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsUUID() rotaId?: string;
  /** Concorrência otimista (decisão da auditoria — P1): versão que o cliente leu. */
  @IsInt() version: number;
}
