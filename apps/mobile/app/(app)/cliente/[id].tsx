import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { db } from '../../../src/db/schema';
import { formatarBRL } from '@locacoes/shared';

interface SaldoRow {
  id: string; valor_restante: string; plaqueta: string;
}

interface LocacaoRow {
  id: string;
  plaqueta: string;
  regra: string;
  status: string;
  saldo_atual: string;
  endereco: string;
}

const NOME_REGRA: Record<string, string> = {
  VALOR_FIXO: 'Valor fixo',
  PERCENTUAL_A_RECEBER: '% a receber',
  PERCENTUAL_A_PAGAR: '% a pagar',
};

export default function ClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [nome, setNome] = useState('');
  const [locacoes, setLocacoes] = useState<LocacaoRow[]>([]);
  const [saldos, setSaldos] = useState<SaldoRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      const cliente = db.getFirstSync<{ nome: string }>(
        'SELECT nome FROM clientes WHERE id = ?', [id]
      );
      setNome(cliente?.nome ?? '');
      setLocacoes(
        db.getAllSync<LocacaoRow>(
          `SELECT l.id, p.plaqueta, l.regra, l.status, l.saldo_atual,
                  (e.logradouro || ', ' || e.numero || ' - ' || e.bairro) AS endereco
           FROM locacoes l
           JOIN produtos p ON p.id = l.produto_id
           JOIN enderecos e ON e.id = l.endereco_id
           WHERE l.cliente_id = ? AND l.is_deleted = 0
           ORDER BY l.status, l.data_inicio DESC`,
          [id]
        )
      );
      setSaldos(
        db.getAllSync<SaldoRow>(
          `SELECT s.id, s.valor_restante, p.plaqueta
           FROM saldos_devedores s
           JOIN locacoes l ON l.id = s.locacao_id
           JOIN produtos p ON p.id = l.produto_id
           WHERE s.cliente_id = ? AND s.status = 'PENDENTE' AND s.is_deleted = 0`,
          [id]
        )
      );
    }, [id])
  );

  return (
    <View style={s.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={s.titulo}>{nome}</Text>
        <Pressable onPress={() => router.push(`/(app)/cliente-editar/${id}`)}>
          <Text style={s.editar}>editar ✎</Text>
        </Pressable>
      </View>

      {saldos.map((sd) => (
        <Pressable key={sd.id} style={s.saldoCard} onPress={() => router.push(`/(app)/saldo/${sd.id}`)}>
          <Text style={s.saldoTexto}>
            Dívida de locação finalizada ({sd.plaqueta}): {formatarBRL(sd.valor_restante)}
          </Text>
          <Text style={s.saldoAcao}>Tocar para registrar pagamento →</Text>
        </Pressable>
      ))}

      <FlatList
        data={locacoes}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => {
          const saldo = Number(item.saldo_atual);
          return (
            <Pressable
              style={[s.card, item.status !== 'ATIVA' && s.cardInativa]}
              disabled={item.status !== 'ATIVA'}
              onPress={() => router.push(`/(app)/cobranca/${item.id}`)}
            >
              <View style={s.linha}>
                <Text style={s.plaqueta}>{item.plaqueta}</Text>
                <Text style={s.regra}>{NOME_REGRA[item.regra] ?? item.regra}</Text>
              </View>
              <Text style={s.endereco}>{item.endereco}</Text>
              {saldo !== 0 && (
                <Text style={saldo > 0 ? s.deve : s.haver}>
                  {saldo > 0 ? `Saldo devedor: ${formatarBRL(saldo)}` : `Haver: ${formatarBRL(-saldo)}`}
                </Text>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                {item.status === 'ATIVA'
                  ? <Text style={s.acao}>Tocar para cobrar →</Text>
                  : <View />}
                <Pressable onPress={(e) => { e.stopPropagation(); router.push(`/(app)/historico/${item.id}`); }}>
                  <Text style={s.historico}>histórico</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={s.vazio}>Sem locações para este cliente.</Text>}
      />
      <Pressable style={s.botaoNova} onPress={() => router.push(`/(app)/locacao-nova/${id}`)}>
        <Text style={s.botaoNovaTexto}>＋ Nova locação</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ea', padding: 12 },
  titulo: { fontSize: 20, fontWeight: '800', marginBottom: 12, color: '#1b5e3f' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8 },
  cardInativa: { opacity: 0.5 },
  linha: { flexDirection: 'row', justifyContent: 'space-between' },
  plaqueta: { fontWeight: '700', fontSize: 16 },
  regra: { color: '#1b5e3f', fontWeight: '600' },
  endereco: { color: '#666', fontSize: 13, marginTop: 2 },
  deve: { color: '#b3261e', marginTop: 4, fontWeight: '600' },
  haver: { color: '#1b5e3f', marginTop: 4, fontWeight: '600' },
  acao: { color: '#999', fontSize: 12 },
  historico: { color: '#1b5e3f', fontSize: 12, fontWeight: '600' },
  editar: { color: '#1b5e3f', fontWeight: '600', marginBottom: 12 },
  botaoNova: { backgroundColor: '#1b5e3f', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  botaoNovaTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  vazio: { textAlign: 'center', color: '#888', marginTop: 40 },
  saldoCard: { backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f5c6c0' },
  saldoTexto: { color: '#8a1c12', fontWeight: '600', fontSize: 13 },
  saldoAcao: { color: '#b3261e', fontSize: 11, marginTop: 4 },
});
