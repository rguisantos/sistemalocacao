import { criarApp } from './app';
import { env } from './config/env';
import { prisma } from '@locacoes/database';
import { iniciarExpurgoLogs } from './jobs/expurgo-logs';

const app = criarApp();
iniciarExpurgoLogs();
const server = app.listen(env.PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${env.PORT}`);
});

// Graceful shutdown: para de aceitar conexões, espera as em andamento
// terminarem e fecha o pool do Prisma. Evita cobranças cortadas no meio
// da transação em deploys/restarts.
let encerrando = false;
async function encerrar(sinal: string) {
  if (encerrando) return;
  encerrando = true;
  console.log(`\n${sinal} recebido — encerrando com segurança…`);

  const forcar = setTimeout(() => {
    console.error('Timeout de 10s — encerrando à força.');
    process.exit(1);
  }, 10_000);
  forcar.unref();

  server.close(async () => {
    await prisma.$disconnect();
    console.log('✅ Conexões encerradas.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));
