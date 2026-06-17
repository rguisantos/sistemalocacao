import { IsInt, IsOptional, IsString, Length } from 'class-validator';
export class CriarRotaDto { @IsString() @Length(1, 120) nome: string; }
export class AtualizarRotaDto {
  @IsOptional() @IsString() @Length(1, 120) nome?: string;
  @IsInt() version: number;
}
