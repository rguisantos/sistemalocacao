// Expurgo automático de logs de auditoria com mais de 1 ano (spec §11).
// Job interno: roda na subida (após 1 min) e a cada 24h, sem cron externo.
import { prisma } from '@locacoes/database';

const UM_ANO_MS = 365 * 24 * 60 * 60 * 1000;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

async function executarExpurgo() {
  try {
    const limite = new Date(Date.now() - UM_ANO_MS);
    const { count } = await prisma.logAuditoria.deleteMany({
      where: { createdAt: { lt: limite } },
    });
    if (count > 0) {
      console.log(`🧹 Expurgo de auditoria: ${count} log(s) com mais de 1 ano removido(s).`);
      // Deixa rastro do próprio expurgo (sem usuário — ação do sistema)
      await prisma.logAuditoria.create({
        data: {
          acao: 'expurgo_logs_auditoria',
          entidade: 'LogAuditoria',
          dadosNovos: { removidos: count, limite: limite.toISOString() },
        },
      });
    }
  } catch (e) {
    console.error('Falha no expurgo de logs:', e);
  }
}

export function iniciarExpurgoLogs() {
  const inicial = setTimeout(executarExpurgo, 60_000);
  const diario = setInterval(executarExpurgo, UM_DIA_MS);
  inicial.unref();
  diario.unref(); // não impede o graceful shutdown
}
