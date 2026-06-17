import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { listarRotas } from '../../dominio/repositorios';
import { sincronizar } from '../../sync/sync-client';
import { cores, espaco, raio, fonte } from '../tema';
import { IconeChip, EmptyState } from '../componentes/kit';

export function RotasScreen({ navigation }: any) {
  const [rotas, setRotas] = useState<any[]>([]); const [sincronizando, setSinc] = useState(false);
  const carregar = () => listarRotas().then(setRotas);
  useEffect(() => { carregar(); return navigation.addListener('focus', carregar); }, [navigation]);

  async function sync() {
    setSinc(true);
    try { const r = await sincronizar(); await carregar(); if (r.conflitos?.length) Alert.alert('Sincronizado', `${r.conflitos.length} conflito(s) resolvido(s) pelo servidor.`); }
    catch { Alert.alert('Sincronização', 'Sem conexão no momento.'); }
    finally { setSinc(false); }
  }
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={sync} style={{ paddingHorizontal: 4 }}>
          <Ionicons name={sincronizando ? 'sync-circle' : 'sync'} size={22} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [sincronizando]);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <FlatList
        data={rotas}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: espaco.lg, gap: espaco.md }}
        ListHeaderComponent={
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('ListaCobranca')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md, backgroundColor: '#fff', borderRadius: raio.lg, padding: espaco.md, borderWidth: 1, borderColor: cores.borda, marginBottom: espaco.sm }}>
            <IconeChip nome="cash" cor={cores.aviso} />
            <Text style={{ ...fonte.corpo, fontWeight: '600', flex: 1 }}>Cobranças pendentes</Text>
            <Ionicons name="chevron-forward" size={18} color={cores.leve} />
          </TouchableOpacity>
        }
        ListEmptyComponent={<EmptyState icone="map-outline" titulo="Nenhuma rota" descricao="Sincronize para baixar seus dados." />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Clientes', { rotaId: item.id, nome: item.nome })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md, backgroundColor: '#fff', borderRadius: raio.lg, padding: espaco.md, borderWidth: 1, borderColor: cores.borda }}>
            <IconeChip nome="map" cor={cores.primaria} />
            <Text style={{ ...fonte.corpo, fontWeight: '600', flex: 1 }}>{item.nome}</Text>
            <Ionicons name="chevron-forward" size={18} color={cores.leve} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
