import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { FormaPagamentoDto } from '../../cobrancas/dto/registrar-cobranca.dto';

export class PagarSaldoDto {
  /** UUID do pagamento gerado no cliente — idempotência. */
  @IsOptional() @IsUUID() pagamentoId?: string;
  @IsNumber() @Min(0.01) valor: number;
  @IsEnum(FormaPagamentoDto) formaPagamento: FormaPagamentoDto;
  @IsOptional() @IsString() pixId?: string;
}
