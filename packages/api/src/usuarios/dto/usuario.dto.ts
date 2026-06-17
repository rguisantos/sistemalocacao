import { ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class CriarUsuarioDto {
  @IsString() nome: string;
  @Matches(/^\d{11}$/, { message: 'CPF deve conter 11 dígitos.' }) cpf: string;
  @MinLength(6) senha: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) rotaIds?: string[];
  @IsOptional() @IsString() papel?: string;                 // preset (Administrador/Secretario/AcessoControlado)
  @IsOptional() @IsArray() @ArrayUnique() permissoes?: string[]; // chaves explícitas (somam ao papel)
}

export class AtualizarUsuarioDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @MinLength(6) novaSenha?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) rotaIds?: string[];
  @IsInt() version: number;
}

export class DefinirPermissoesDto {
  @IsOptional() @IsString() papel?: string;
  @IsOptional() @IsArray() @ArrayUnique() permissoes?: string[];
}
