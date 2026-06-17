import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clientesDaRota } from '../../dominio/repositorios';
import { cores, espaco, raio, fonte } from '../tema';
import { IconeChip, StatusBadge, EmptyState, BotaoPrimario } from '../componentes/kit';

export function ClientesScreen({ route, navigation }: any) {
  const { rotaId } = route.params;
  const [todosCli, setTodos] = useState<any[]>([]); const [busca, setBusca] = useState('');

  useEffect(() => {
    const carregar = () => clientesDaRota(rotaId).then(setTodos);
    carregar();
    return navigation.addListener('focus', carregar);
  }, [rotaId, navigation]);

  const filtrados = todosCli.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <View style={{ padding: espaco.lg, gap: espaco.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: raio.md, paddingHorizontal: 12, borderWidth: 1, borderColor: cores.borda }}>
          <Ionicons name="search" size={18} color={cores.leve} />
          <TextInput placeholder="Buscar cliente" value={busca} onChangeText={setBusca} style={{ flex: 1, paddingVertical: 12 }} placeholderTextColor={cores.leve} />
        </View>
        <BotaoPrimario titulo="Novo cliente" icone="add" onPress={() => navigation.navigate('NovoCliente', { rotaId })} />
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: espaco.lg, paddingBottom: espaco.xl, gap: espaco.md }}
        ListEmptyComponent={<EmptyState icone="people-outline" titulo="Nenhum cliente" descricao="Crie o primeiro cliente desta rota." />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Cliente', { clienteId: item.id, nome: item.nome })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md, backgroundColor: '#fff', borderRadius: raio.lg, padding: espaco.md, borderWidth: 1, borderColor: cores.borda }}>
            <IconeChip nome="person" cor={item.temSaldo > 0 ? cores.aviso : cores.primaria} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ ...fonte.corpo, fontWeight: '600' }} numberOfLines={1}>{item.nome}</Text>
              {item.temSaldo > 0
                ? <StatusBadge status="aviso" texto="Saldo devedor" />
                : <StatusBadge status="sucesso" texto="Em dia" />}
            </View>
            <Ionicons name="chevron-forward" size={18} color={cores.leve} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
