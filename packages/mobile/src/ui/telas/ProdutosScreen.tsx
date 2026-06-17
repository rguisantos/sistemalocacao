import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { listarProdutos } from '../../dominio/repositorios';
import { cores, espaco, raio, fonte } from '../tema';
import { IconeChip, EmptyState, BotaoPrimario } from '../componentes/kit';

export function ProdutosScreen({ navigation }: any) {
  const [itens, setItens] = useState<any[]>([]);
  useEffect(() => {
    const carregar = () => listarProdutos().then(setItens);
    carregar();
    return navigation.addListener('focus', carregar);
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <View style={{ padding: espaco.lg }}>
        <BotaoPrimario titulo="Novo produto" icone="add" onPress={() => navigation.navigate('NovoProduto')} />
      </View>
      <FlatList
        data={itens}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: espaco.lg, paddingBottom: espaco.xl, gap: espaco.md }}
        ListEmptyComponent={<EmptyState icone="cube-outline" titulo="Nenhum produto" descricao="Cadastre o primeiro produto." />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('EditarProduto', { produtoId: item.id })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md, backgroundColor: '#fff', borderRadius: raio.lg, padding: espaco.md, borderWidth: 1, borderColor: cores.borda }}>
            <IconeChip nome="cube" cor={cores.info} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...fonte.corpo, fontWeight: '600' }}>{item.plaqueta} {item.descricao ?? ''}</Text>
              <Text style={{ color: cores.suave, fontSize: 12 }}>contador {item.contador}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={cores.leve} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
