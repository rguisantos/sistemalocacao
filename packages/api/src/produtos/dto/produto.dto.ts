import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CriarProdutoDto {
  @IsString() @Length(1, 60) plaqueta: string;
  @IsUUID() tipoId: string;
  @IsOptional() @IsString() descricao?: string;     // cor (texto)
  @IsOptional() @IsUUID() corId?: string;            // cor (cadastro auxiliar)
  @IsUUID() tamanhoId: string;
  @IsUUID() condicaoId: string;
  @IsOptional() @IsString() chave?: string;
  @IsOptional() @IsInt() @Min(0) contador?: number;
}
export class AtualizarProdutoDto {
  @IsOptional() @IsString() @Length(1, 60) plaqueta?: string;
  @IsOptional() @IsUUID() tipoId?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsUUID() corId?: string;
  @IsOptional() @IsUUID() tamanhoId?: string;
  @IsOptional() @IsUUID() condicaoId?: string;
  @IsOptional() @IsString() chave?: string;
  @IsInt() version: number;
}
export class AlterarContadorDto {
  @IsInt() @Min(0) contador: number;
  @IsInt() version: number;
}
