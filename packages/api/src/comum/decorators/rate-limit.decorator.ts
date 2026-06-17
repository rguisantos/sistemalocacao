import { SetMetadata } from '@nestjs/common';
import { PoliticaLimite } from '@app/core';
/** Aplica uma política de rate limit específica à rota (ex.: LIMITES_PADRAO.auth). */
export const RATE_LIMIT = 'rate_limit';
export const RateLimit = (politica: PoliticaLimite) => SetMetadata(RATE_LIMIT, politica);
