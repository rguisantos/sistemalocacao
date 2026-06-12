// apps/api/src/services/vencidas.service.ts
// ============================================================
// COBRANÇAS VENCIDAS
// - VALOR_FIXO: vencida quando (última cobrança ou início) + frequência
//   já passou. Dias de atraso e valor estimado (períodos × valor fixo).
// - PERCENTUAL: sem leitura de contador há mais de `diasPercentual`
//   (padrão 30) — alerta operacional, sem valor estimável.
// ============================================================
import { prisma } from '@locacoes/database';
import { DIAS_FREQUENCIA, D, arredondar } from '@locacoes/shared';

export interface LocacaoVencida {
  locacaoId: string;
  regra: string;
  plaqueta: string;
  cliente: { id: string; nome: string; telefones: unknown };
  rota: string;
  endereco: string;
  ultimaCobranca: string | null; // ISO; null = nunca cobrada
  diasSemCobranca: number;
  diasAtraso: number;            // além do prazo da frequência (fixo) ou do limite (percentual)
  valorEstimado: string | null;  // apenas VALOR_FIXO
  saldoAtual: string;
}

export async function listarVencidas(opts: {
  rotaIds?: string[];        // restrição por rotas do usuário
  todasRotas: boolean;
  diasPercentual?: number;
}): Promise<LocacaoVencida[]> {
  const diasPercentual = opts.diasPercentual ?? 30;
  const agora = Date.now();
  const msDia = 24 * 60 * 60 * 1000;

  const locacoes = await prisma.locacao.findMany({
    where: {
      status: 'ATIVA',
      isDeleted: false,
      ...(opts.todasRotas ? {} : { cliente: { rotaId: { in: opts.rotaIds ?? [] } } }),
    },
    include: {
      produto: { select: { plaqueta: true } },
      cliente: { select: { id: true, nome: true, telefones: true, rota: { select: { nome: true } } } },
      endereco: { select: { logradouro: true, numero: true, bairro: true } },
      cobrancas: {
        where: { isDeleted: false },
        orderBy: { dataCobranca: 'desc' },
        take: 1,
        select: { dataCobranca: true },
      },
    },
  });

  const vencidas: LocacaoVencida[] = [];

  for (const l of locacoes) {
    const ultima = l.cobrancas[0]?.dataCobranca ?? null;
    const referencia = ultima ?? l.dataInicio;
    const diasSemCobranca = Math.floor((agora - referencia.getTime()) / msDia);

    let limite: number;
    let valorEstimado: string | null = null;

    if (l.regra === 'VALOR_FIXO') {
      limite = DIAS_FREQUENCIA[l.frequencia! as keyof typeof DIAS_FREQUENCIA];
      if (diasSemCobranca <= limite) continue;
      const periodos = Math.max(1, Math.ceil(diasSemCobranca / limite));
      valorEstimado = arredondar(D(l.valorFixo!.toFixed(2)).mul(periodos)).toFixed(2);
    } else {
      limite = diasPercentual;
      if (diasSemCobranca <= limite) continue;
    }

    vencidas.push({
      locacaoId: l.id,
      regra: l.regra,
      plaqueta: l.produto.plaqueta,
      cliente: { id: l.cliente.id, nome: l.cliente.nome, telefones: l.cliente.telefones },
      rota: l.cliente.rota.nome,
      endereco: `${l.endereco.logradouro}, ${l.endereco.numero} – ${l.endereco.bairro}`,
      ultimaCobranca: ultima?.toISOString() ?? null,
      diasSemCobranca,
      diasAtraso: diasSemCobranca - limite,
      valorEstimado,
      saldoAtual: l.saldoAtual.toFixed(2),
    });
  }

  // mais atrasadas primeiro
  return vencidas.sort((a, b) => b.diasAtraso - a.diasAtraso);
}

export async function contarVencidas(opts: { rotaIds?: string[]; todasRotas: boolean }) {
  const lista = await listarVencidas(opts);
  const valorTotal = lista.reduce((acc, v) => acc.add(D(v.valorEstimado ?? 0)), D(0));
  return {
    total: lista.length,
    valorFixoVencidas: lista.filter((v) => v.regra === 'VALOR_FIXO').length,
    percentuaisSemLeitura: lista.filter((v) => v.regra !== 'VALOR_FIXO').length,
    valorEstimadoTotal: arredondar(valorTotal).toFixed(2),
  };
}
