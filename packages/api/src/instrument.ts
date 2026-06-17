// Sentry: este arquivo DEVE ser importado antes de qualquer outro módulo.
// Veja main.ts — import './instrument' é a primeira linha.
//
// Sem SENTRY_DSN no ambiente, init() é no-op → zero impacto em CI, testes e dev local.

import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  // Taxa baixa em produção pra não estourar quota do plano free.
  // Ajuste pra 1.0 (100%) durante investigação ativa de incidente.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
