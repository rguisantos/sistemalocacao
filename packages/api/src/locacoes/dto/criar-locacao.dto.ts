import { IsEnum, IsNumber, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';

export enum RegraDto { VALOR_FIXO = 'VALOR_FIXO', PERCENTUAL_A_RECEBER = 'PERCENTUAL_A_RECEBER', PERCENTUAL_A_PAGAR = 'PERCENTUAL_A_PAGAR' }
export enum FrequenciaDto { SEMANAL = 'SEMANAL', QUINZENAL = 'QUINZENAL', MENSAL = 'MENSAL' }

export class CriarLocacaoDto {
  @IsUUID() produtoId: string;
  @IsUUID() clienteId: string;
  @IsUUID() enderecoId: string;
  @IsEnum(RegraDto) regra: RegraDto;

  // VALOR_FIXO
  @ValidateIf((o) => o.regra === RegraDto.VALOR_FIXO)
  @IsEnum(FrequenciaDto) frequencia?: FrequenciaDto;
  @ValidateIf((o) => o.regra === RegraDto.VALOR_FIXO)
  @IsNumber() @Min(0) valorFixo?: number;

  // PERCENTUAL
  @ValidateIf((o) => o.regra !== RegraDto.VALOR_FIXO)
  @IsNumber() @Min(0) valorPartida?: number;
  @ValidateIf((o) => o.regra !== RegraDto.VALOR_FIXO)
  @IsNumber() @Min(0) percentual?: number;

  @IsOptional() @IsNumber() contadorInicial?: number;
}
