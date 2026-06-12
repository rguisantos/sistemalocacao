// Produtos em depósito — consulta 100% local (funciona offline).
// Um produto está em depósito quando sua última locação foi
// FINALIZADA com tipo DEPOSITO e não há locação ativa.
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { db } from '../../src/db/schema';

interface ProdutoDepositoRow {
  id: string;
  plaqueta: string;
  contador: number;
  deposito_nome: string | null;
  cliente_nome: string | null;
  data_fim: string | null;
}

export default function DepositoScreen() {
  const [produtos, setProdutos] = useState<ProdutoDepositoRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      setProdutos(
        db.getAllSync<ProdutoDepositoRow>(
          `SELECT p.id, p.plaqueta, p.contador,
                  d.nome AS deposito_nome, c.nome AS cliente_nome, ult.data_fim
           FROM produtos p
           JOIN locacoes ult ON ult.id = (
             SELECT l2.id FROM locacoes l2
             WHERE l2.produto_id = p.id AND l2.is_deleted = 0
             ORDER BY l2.data_inicio DESC LIMIT 1
           )
           LEFT JOIN depositos d ON d.id = ult.deposito_id
           LEFT JOIN clientes c ON c.id = ult.cliente_id
           WHERE p.is_deleted = 0
             AND ult.status = 'FINALIZADA'
             AND ult.finalizacao_tipo = 'DEPOSITO'
           ORDER BY p.plaqueta`
        )
      );
    }, [])
  );

  return (
    <View style={s.container}>
      <FlatList
        data={produtos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.linha}>
              <Text style={s.plaqueta}>{item.plaqueta}</Text>
              <Text style={s.deposito}>{item.deposito_nome ?? 'Depósito não informado'}</Text>
            </View>
            <Text style={s.detalhe}>
              Contador: {item.contador}
              {item.cliente_nome ? ` · veio de ${item.cliente_nome}` : ''}
              {item.data_fim ? ` · ${new Date(item.data_fim).toLocaleDateString('pt-BR')}` : ''}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={s.vazio}>Nenhum produto em depósito. Sincronize para atualizar.</Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ea' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plaqueta: { fontWeight: '700', fontSize: 16 },
  deposito: { color: '#1b5e3f', fontWeight: '600', fontSize: 13 },
  detalhe: { color: '#666', fontSize: 13, marginTop: 4 },
  vazio: { textAlign: 'center', color: '#888', marginTop: 40, paddingHorizontal: 24 },
});
