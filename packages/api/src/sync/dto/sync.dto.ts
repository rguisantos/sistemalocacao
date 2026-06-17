import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class PullDto {
  /** ISO do último pull (relógio do SERVIDOR). Null no primeiro sync. */
  @IsOptional() @IsString() lastPulledAt?: string | null;
  @IsOptional() @IsBoolean() fullSync?: boolean;
}

export class PushDto {
  /** Chave de idempotência por lote (descarta reenvio do mesmo push). */
  @IsString() idempotencyKey: string;
  @IsObject() mudancas: Record<string, any[]>;
}
