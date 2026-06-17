import { IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoClienteDto { PF = 'PF', PJ = 'PJ' }

/** Endereço informado já na criação do cliente (o endereço é cadastrado no cliente). */
export class EnderecoEmbutidoDto {
  @IsString() @Length(1, 200) logradouro: string;
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() complemento?: string;
  @IsOptional() @IsString() bairro?: string;
  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() @Length(2, 2) estado?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}

export class CriarClienteDto {
  @IsEnum(TipoClienteDto) tipo: TipoClienteDto;
  @IsString() @Length(2, 200) nome: string;
  @IsString() @Length(11, 14) cpfCnpj: string;
  @IsOptional() @IsString() rgIe?: string;
  @IsOptional() @IsArray() telefones?: string[];
  @IsOptional() @IsString() observacoes?: string;
  @IsUUID() rotaId: string;
  @IsOptional() @ValidateNested() @Type(() => EnderecoEmbutidoDto) endereco?: EnderecoEmbutidoDto;
}
