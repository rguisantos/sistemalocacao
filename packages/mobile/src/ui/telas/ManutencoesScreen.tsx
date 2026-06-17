import React, { useEffect, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import { listarManutencoes } from '../../dominio/repositorios';
import { cores, espaco, raio, fonte } from '../tema';
import { IconeChip, EmptyState } from '../componentes/kit';

const PT: Record<string, string> = { TROCA_PANO: 'Troca de pano', CONSERTO: 'Conserto', LIMPEZA: 'Limpeza', OUTROS: 'Outros' };

export function ManutencoesScreen() {
  const [itens, setItens] = useState<any[]>([]);
  useEffect(() => { listarManutencoes().then(setItens); }, []);
  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <FlatList data={itens} keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: espaco.lg, gap: espaco.md }}
        ListEmptyComponent={<EmptyState icone="construct-outline" titulo="Sem manutenções" descricao="As manutenções registradas aparecerão aqui." />}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md, backgroundColor: '#fff', borderRadius: raio.lg, padding: espaco.md, borderWidth: 1, borderColor: cores.borda }}>
            <IconeChip nome="construct" cor={cores.info} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...fonte.corpo, fontWeight: '600' }}>{item.plaqueta} • {PT[item.tipo] ?? item.tipo}</Text>
              <Text style={{ color: cores.suave, fontSize: 13 }}>{new Date(item.data).toLocaleDateString('pt-BR')}{item.descricao ? ` — ${item.descricao}` : ''}</Text>
            </View>
          </View>
        )} />
    </View>
  );
}
