import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum FormaPagamentoDto { DINHEIRO = 'DINHEIRO', PIX_MANUAL = 'PIX_MANUAL', CARTAO = 'CARTAO', PIX_MERCADO_PAGO = 'PIX_MERCADO_PAGO' }

class PagamentoEmbutidoDto {
  @IsNumber() @Min(0) valor: number;
  @IsEnum(FormaPagamentoDto) formaPagamento: FormaPagamentoDto;
  @IsOptional() @IsString() pixId?: string;
}

export class RegistrarCobrancaDto {
  /** UUID gerado no cliente — idempotência (decisão da auditoria — P0). */
  @IsOptional() @IsUUID() id?: string;
  @IsUUID() locacaoId: string;
  @IsOptional() @IsString() dataCobranca?: string;

  // PERCENTUAL
  @IsOptional() @IsInt() contadorAtual?: number;
  @IsOptional() @IsBoolean() contadorReiniciado?: boolean;
  @IsOptional() @IsInt() @Min(0) descontoPartidas?: number;
  @IsOptional() @IsNumber() @Min(0) descontoValorReceber?: number;

  // comum
  @IsOptional() @IsNumber() @Min(0) acrescimo?: number;
  @IsOptional() @IsBoolean() trocaPano?: boolean;

  @IsOptional() @ValidateNested() @Type(() => PagamentoEmbutidoDto)
  pagamento?: PagamentoEmbutidoDto;
}
