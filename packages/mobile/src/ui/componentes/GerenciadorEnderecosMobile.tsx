import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, Alert } from 'react-native';
import { MapaLeaflet } from './MapaLeaflet';
import { enderecosDoCliente, adicionarEndereco, atualizarEndereco, removerEndereco } from '../../dominio/repositorios';

const entrada = { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 } as const;

/** Lista e edita os endereços de um cliente (offline). */
export function GerenciadorEnderecosMobile({ clienteId }: { clienteId: string }) {
  const [lista, setLista] = useState<any[]>([]);
  const [ed, setEd] = useState<any | null>(null);

  const carregar = () => enderecosDoCliente(clienteId).then(setLista);
  useEffect(() => { carregar(); }, [clienteId]);

  async function salvar() {
    if (!ed.logradouro) return Alert.alert('Atenção', 'Informe o logradouro.');
    try {
      if (ed.id) await atualizarEndereco(ed.id, ed); else await adicionarEndereco(clienteId, ed);
      setEd(null); carregar();
    } catch (e: any) { Alert.alert('Erro', e.message); }
  }
  async function remover(id: string) {
    Alert.alert('Remover', 'Excluir este endereço?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await removerEndereco(id); carregar(); } },
    ]);
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '600' }}>Endereços</Text>
        {!ed && <Button title="Adicionar" onPress={() => setEd({})} />}
      </View>

      {!ed && lista.length === 0 && <Text style={{ color: '#6B7B72' }}>Nenhum endereço.</Text>}
      {!ed && lista.map((e) => (
        <View key={e.id} style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text>{e.logradouro}{e.numero ? `, ${e.numero}` : ''}</Text>
            <Text style={{ color: '#6B7B72', fontSize: 12 }}>{e.cidade ?? ''}{e.estado ? `/${e.estado}` : ''}{e.latitude ? ` • ${Number(e.latitude).toFixed(4)},${Number(e.longitude).toFixed(4)}` : ''}</Text>
          </View>
          <TouchableOpacity onPress={() => setEd({ ...e })}><Text style={{ color: '#11392B', marginRight: 12 }}>Editar</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => remover(e.id)}><Text style={{ color: '#B4452F' }}>Excluir</Text></TouchableOpacity>
        </View>
      ))}

      {ed && (
        <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, gap: 8 }}>
          <TextInput placeholder="Logradouro" value={ed.logradouro ?? ''} onChangeText={(v) => setEd({ ...ed, logradouro: v })} style={entrada} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput placeholder="Número" value={ed.numero ?? ''} onChangeText={(v) => setEd({ ...ed, numero: v })} style={[entrada, { flex: 1 }]} />
            <TextInput placeholder="Bairro" value={ed.bairro ?? ''} onChangeText={(v) => setEd({ ...ed, bairro: v })} style={[entrada, { flex: 1 }]} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput placeholder="Cidade" value={ed.cidade ?? ''} onChangeText={(v) => setEd({ ...ed, cidade: v })} style={[entrada, { flex: 2 }]} />
            <TextInput placeholder="UF" maxLength={2} autoCapitalize="characters" value={ed.estado ?? ''} onChangeText={(v) => setEd({ ...ed, estado: v.toUpperCase() })} style={[entrada, { flex: 1 }]} />
          </View>
          <MapaLeaflet latitude={ed.latitude} longitude={ed.longitude} altura={180}
            onChange={(la, ln) => setEd({ ...ed, latitude: la, longitude: ln })} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Cancelar" color="#888" onPress={() => setEd(null)} /></View>
            <View style={{ flex: 1 }}><Button title="Salvar" onPress={salvar} /></View>
          </View>
        </View>
      )}
    </View>
  );
}
