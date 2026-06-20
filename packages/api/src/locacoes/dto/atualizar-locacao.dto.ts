import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { FrequenciaDto } from './criar-locacao.dto';

/**
 * Edição de locação (admin). Escopo intencionalmente limitado:
 *  - Só os parâmetros da regra ATUAL (não troca a regra nem o produto/cliente,
 *    o que quebraria o histórico e a trava de locação ativa por produto).
 *  - Alterar parâmetros NÃO recalcula cobranças passadas — cada cobrança guarda
 *    seu próprio snapshot (regraVersao). Por isso o servidor incrementa regraVersao.
 */
export class AtualizarLocacaoDto {
  // VALOR_FIXO
  @IsOptional() @IsEnum(FrequenciaDto) frequencia?: FrequenciaDto;
  @IsOptional() @IsNumber() @Min(0) valorFixo?: number;

  // PERCENTUAL
  @IsOptional() @IsNumber() @Min(0) valorPartida?: number;
  @IsOptional() @IsNumber() @Min(0) percentual?: number;

  // comum
  @IsOptional() @IsUUID() enderecoId?: string;
  @IsOptional() @IsDateString() dataInicio?: string;

  /** Concorrência otimista (decisão da auditoria — P1): versão que o cliente leu. */
  @IsInt() version: number;
}
