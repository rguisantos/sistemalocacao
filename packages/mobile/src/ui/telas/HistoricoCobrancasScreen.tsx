import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { cobrancasDoCliente } from '../../dominio/repositorios';
import { formatarBRL } from '@app/core';
import { cores, espaco, raio, fonte } from '../tema';
import { IconeChip, StatusBadge, EmptyState } from '../componentes/kit';

const statusMap: Record<string, ['sucesso' | 'aviso' | 'perigo', string]> = {
  PAGO: ['sucesso', 'Pago'], PARCIAL: ['aviso', 'Parcial'], PENDENTE: ['perigo', 'Pendente'],
};

export function HistoricoCobrancasScreen({ route, navigation }: any) {
  const { clienteId } = route.params;
  const [itens, setItens] = useState<any[]>([]);
  useEffect(() => { cobrancasDoCliente(clienteId).then(setItens); }, [clienteId]);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <FlatList data={itens} keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: espaco.lg, gap: espaco.md }}
        ListEmptyComponent={<EmptyState icone="receipt-outline" titulo="Sem cobranças" descricao="As cobranças deste cliente aparecerão aqui." />}
        renderItem={({ item }) => {
          const [st, lbl] = statusMap[item.statusPagamento] ?? ['perigo', item.statusPagamento];
          return (
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('CobrancaDetail', { cobrancaId: item.id })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md, backgroundColor: '#fff', borderRadius: raio.lg, padding: espaco.md, borderWidth: 1, borderColor: cores.borda }}>
              <IconeChip nome="receipt" cor={cores.primaria} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...fonte.corpo, fontWeight: '600' }}>{item.plaqueta} {item.produtoDescricao ?? ''}</Text>
                <Text style={{ color: cores.suave, fontSize: 12 }}>{new Date(item.dataCobranca).toLocaleString('pt-BR')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ ...fonte.valor, fontSize: 16 }}>{formatarBRL(item.valorLiquidoFinal)}</Text>
                <StatusBadge status={st} texto={lbl} />
              </View>
            </TouchableOpacity>
          );
        }} />
    </View>
  );
}
