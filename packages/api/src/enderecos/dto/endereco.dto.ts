import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CriarEnderecoDto {
  @IsUUID() clienteId: string;
  @IsString() @Length(1, 200) logradouro: string;
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() complemento?: string;
  @IsOptional() @IsString() bairro?: string;
  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() @Length(2, 2) estado?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsNumber() latitude?: number;   // Leaflet/GPS
  @IsOptional() @IsNumber() longitude?: number;
}
export class AtualizarEnderecoDto {
  @IsOptional() @IsString() @Length(1, 200) logradouro?: string;
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() complemento?: string;
  @IsOptional() @IsString() bairro?: string;
  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() @Length(2, 2) estado?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsInt() version: number;
}
