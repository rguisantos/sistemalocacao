// apps/mobile/app/(app)/historico/[locacaoId].tsx
// Histórico de cobranças da locação, com reimpressão de recibo.
// Online: busca o histórico completo na API.
// Offline: mostra as cobranças registradas neste aparelho.
import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { db } from '../../../src/db/schema';
import { api } from '../../../src/services/api';
import { estaOnline } from '../../../src/services/sync';
import { imprimirRecibo } from '../../../src/services/impressora';
import { useApp } from '../../../src/store/app';
import { formatarBRL } from '@locacoes/shared';

interface ItemHistorico {
  id: string;
  dataCobranca: string;
  contadorAnterior: number | null;
  contadorAtual: number | null;
  valorLiquidoFinal: string;
  valorRecebidoPago: string;
  saldoResultante: string;
  formaPagamento: string;
  statusPagamento?: string;
  trocaPano?: boolean;
  cobrador: string;
  local: boolean; // veio do banco local (offline)
}

const NOME_FORMA: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX_MANUAL: 'PIX', CARTAO: 'Cartão', PIX_MERCADO_PAGO: 'PIX QR',
};

export default function HistoricoScreen() {
  const { locacaoId } = useLocalSearchParams<{ locacaoId: string }>();
  const { usuario } = useApp();
  const [itens, setItens] = useState<ItemHistorico[]>([]);
  const [contexto, setContexto] = useState<{ cliente: string; plaqueta: string } | null>(null);
  const [origem, setOrigem] = useState<'online' | 'offline'>('offline');

  function carregarLocal(): ItemHistorico[] {
    return db
      .getAllSync<any>(
        `SELECT * FROM cobrancas WHERE locacao_id = ? ORDER BY data_cobranca DESC`,
        [locacaoId]
      )
      .map((c) => ({
        id: c.id,
        dataCobranca: c.data_cobranca,
        contadorAnterior: c.contador_anterior,
        contadorAtual: c.contador_atual,
        valorLiquidoFinal: c.valor_liquido_final,
        valorRecebidoPago: c.valor_recebido_pago,
        saldoResultante: c.saldo_resultante,
        formaPagamento: c.forma_pagamento,
        statusPagamento: c.status_pagamento ?? 'PAGO',
        trocaPano: !!c.troca_pano,
        cobrador: c.cobrador_nome ?? usuario?.nome ?? 'Este aparelho',
        local: true,
      }));
  }

  useFocusEffect(
    useCallback(() => {
      const ctx = db.getFirstSync<{ cliente: string; plaqueta: string }>(
        `SELECT c.nome AS cliente, p.plaqueta
         FROM locacoes l JOIN clientes c ON c.id = l.cliente_id
         JOIN produtos p ON p.id = l.produto_id WHERE l.id = ?`,
        [locacaoId]
      );
      setContexto(ctx);
      setItens(carregarLocal());

      (async () => {
        if (!(await estaOnline())) return;
        try {
          const remoto = await api<any[]>(`/api/locacoes/${locacaoId}/cobrancas`);
          setItens(
            remoto.map((c) => ({
              id: c.id,
              dataCobranca: c.dataCobranca,
              contadorAnterior: c.contadorAnterior,
              contadorAtual: c.contadorAtual,
              valorLiquidoFinal: c.valorLiquidoFinal,
              valorRecebidoPago: c.valorRecebidoPago,
              saldoResultante: c.saldoResultante,
              formaPagamento: c.formaPagamento,
              statusPagamento: c.statusPagamento,
              trocaPano: !!c.trocaPano,
              cobrador: c.usuario?.nome ?? '—',
              local: false,
            }))
          );
          setOrigem('online');
        } catch {
          // mantém o histórico local
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locacaoId])
  );

  async function reimprimir(item: ItemHistorico) {
    if (!contexto) return;
    const passos = [];
    if (item.contadorAnterior != null && item.contadorAtual != null) {
      passos.push({
        descricao: `Partidas (${item.contadorAtual} − ${item.contadorAnterior})`,
        valor: String(item.contadorAtual - item.contadorAnterior),
      });
    }
    passos.push({ descricao: 'Valor devido', valor: formatarBRL(item.valorLiquidoFinal) });
    const saldo = Number(item.saldoResultante);
    if (saldo !== 0) {
      passos.push({
        descricao: saldo > 0 ? 'Saldo devedor' : 'Haver do cliente',
        valor: formatarBRL(Math.abs(saldo)),
      });
    }

    await imprimirRecibo({
      empresa: 'Sistema de Locações',
      cliente: contexto.cliente,
      produto: contexto.plaqueta,
      data: new Date(item.dataCobranca),
      passos,
      valorPago: item.valorRecebidoPago,
      formaPagamento: NOME_FORMA[item.formaPagamento] ?? item.formaPagamento,
      cobrador: item.cobrador,
      trocaPano: item.trocaPano,
    });
  }

  return (
    <View style={s.container}>
      {contexto && (
        <Text style={s.cabecalho}>
          {contexto.cliente} · {contexto.plaqueta}
          {origem === 'offline' ? '  (somente cobranças deste aparelho)' : ''}
        </Text>
      )}
      <FlatList
        data={itens}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const saldo = Number(item.saldoResultante);
          return (
            <View style={s.card}>
              <View style={s.linha}>
                <Text style={s.data}>{new Date(item.dataCobranca).toLocaleString('pt-BR')}</Text>
                <Text style={s.valor}>{formatarBRL(item.valorRecebidoPago)}</Text>
              </View>
              <Text style={s.detalhe}>
                {NOME_FORMA[item.formaPagamento] ?? item.formaPagamento}
                {item.statusPagamento === 'PENDENTE' ? ' · ⏳ aguardando PIX' : ''}
                {item.statusPagamento === 'PARCIAL' ? ' · parcial' : ''}
                {' · '}{item.cobrador}
                {item.contadorAtual != null ? ` · contador ${item.contadorAtual}` : ''}
                {saldo > 0 ? ` · ficou devendo ${formatarBRL(saldo)}` : ''}
                {saldo < 0 ? ` · haver ${formatarBRL(-saldo)}` : ''}
              </Text>
              <Pressable onPress={() => reimprimir(item)}>
                <Text style={s.reimprimir}>Reimprimir recibo →</Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={s.vazio}>Nenhuma cobrança registrada.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ea' },
  cabecalho: { padding: 12, paddingBottom: 0, color: '#1b5e3f', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8 },
  linha: { flexDirection: 'row', justifyContent: 'space-between' },
  data: { color: '#666', fontSize: 13 },
  valor: { fontWeight: '800', fontSize: 16, color: '#1b5e3f' },
  detalhe: { color: '#888', fontSize: 12, marginTop: 4 },
  reimprimir: { color: '#1b5e3f', fontSize: 13, fontWeight: '600', marginTop: 8 },
  vazio: { textAlign: 'center', color: '#888', marginTop: 40 },
});
