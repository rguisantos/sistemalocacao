import { IsInt, IsOptional, IsString, Length } from 'class-validator';
// Tipo de produto usa "nome"; tamanho e condição usam "descricao".
export class CriarTipoDto { @IsString() @Length(1, 120) nome: string; }
export class AtualizarTipoDto { @IsOptional() @IsString() @Length(1, 120) nome?: string; @IsInt() version: number; }
export class CriarDescricaoDto { @IsString() @Length(1, 120) descricao: string; }
export class AtualizarDescricaoDto { @IsOptional() @IsString() @Length(1, 120) descricao?: string; @IsInt() version: number; }
