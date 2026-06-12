import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'crypto';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { rateLimitApi } from './middleware/rateLimit';
import { authRouter } from './routes/auth.routes';
import { usuariosRouter } from './routes/usuarios.routes';
import { clientesRouter } from './routes/clientes.routes';
import { cadastrosRouter } from './routes/cadastros.routes';
import { locacoesRouter } from './routes/locacoes.routes';
import { syncRouter } from './routes/sync.routes';
import { pagamentosRouter } from './routes/pagamentos.routes';
import { relatoriosRouter } from './routes/relatorios.routes';
import { conflitosRouter } from './routes/conflitos.routes';
import { configuracoesRouter } from './routes/configuracoes.routes';
import { openapiSpec } from './docs/openapi';

export function criarApp() {
  const app = express();

  app.set('trust proxy', 1);

  // Logging estruturado com request-id para correlação.
  // Redação: tokens e senhas NUNCA aparecem nos logs.
  app.use(
    pinoHttp({
      genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.senha',
          'req.body.refreshToken',
        ],
        censor: '[redigido]',
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return env.NODE_ENV === 'production' ? 'info' : 'silent';
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
    })
  );

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(','), credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // Webhook ANTES do rate limit geral (MP pode rajar notificações)
  app.use('/api/pagamentos', pagamentosRouter);

  app.use('/api/auth', authRouter);
  app.use(rateLimitApi);
  app.use('/api/usuarios', usuariosRouter);
  app.use('/api/clientes', clientesRouter);
  app.use('/api', cadastrosRouter);
  app.use('/api/locacoes', locacoesRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/relatorios', relatoriosRouter);
  app.use('/api/conflitos', conflitosRouter);
  app.use('/api/configuracoes', configuracoesRouter);

  // Documentação OpenAPI (spec §15) — Swagger UI via CDN, sem dependência nova
  app.get('/api/docs/openapi.json', (_req, res) => res.json(openapiSpec));
  app.get('/api/docs', (_req, res) => {
    // CSP do helmet bloquearia o CDN: liberar apenas nesta página de docs
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self'"
    );
    res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>API — Sistema de Locações</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js"></script>
<script>SwaggerUIBundle({ url: '/api/docs/openapi.json', dom_id: '#swagger-ui', docExpansion: 'list' });</script>
</body></html>`);
  });

  app.use(errorHandler);
  return app;
}
