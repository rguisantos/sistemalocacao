import { IsInt, IsOptional, IsString, Length } from 'class-validator';
export class CriarDepositoDto {
  @IsString() @Length(1, 120) nome: string;
  @IsOptional() @IsString() endereco?: string;
}
export class AtualizarDepositoDto {
  @IsOptional() @IsString() @Length(1, 120) nome?: string;
  @IsOptional() @IsString() endereco?: string;
  @IsInt() version: number;
}
