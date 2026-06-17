import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cores, raio, espaco, fonte } from '../tema';

export interface Opcao { id: string; rotulo: string; }

/** Seletor (toque abre modal com a lista) — alinhado ao tema. */
export function Selecao({ rotulo, valor, opcoes, aoSelecionar }: { rotulo: string; valor?: string; opcoes: Opcao[]; aoSelecionar: (id: string) => void; }) {
  const [aberto, setAberto] = useState(false);
  const selecionado = opcoes.find((o) => o.id === valor);
  return (
    <View style={{ gap: 6 }}>
      <Text style={fonte.rotulo}>{rotulo}</Text>
      <TouchableOpacity onPress={() => setAberto(true)} activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda, borderRadius: raio.md, paddingHorizontal: 12, paddingVertical: 12 }}>
        <Text style={{ color: selecionado ? cores.texto : cores.leve, fontSize: 15 }}>{selecionado?.rotulo ?? 'Selecione…'}</Text>
        <Ionicons name="chevron-down" size={18} color={cores.leve} />
      </TouchableOpacity>
      <Modal visible={aberto} transparent animationType="slide" onRequestClose={() => setAberto(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setAberto(false)} style={{ flex: 1, backgroundColor: '#0007', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: raio.lg, borderTopRightRadius: raio.lg, maxHeight: '70%', paddingBottom: espaco.xl }}>
            <View style={{ alignItems: 'center', paddingVertical: 10 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: cores.borda }} /></View>
            <Text style={{ ...fonte.secao, paddingHorizontal: espaco.lg, paddingBottom: espaco.sm }}>{rotulo}</Text>
            <FlatList data={opcoes} keyExtractor={(o) => o.id}
              ListEmptyComponent={<Text style={{ padding: espaco.lg, color: cores.suave }}>Nenhuma opção.</Text>}
              renderItem={({ item }) => {
                const ativo = item.id === valor;
                return (
                  <TouchableOpacity onPress={() => { aoSelecionar(item.id); setAberto(false); }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espaco.lg, paddingVertical: 14, borderTopWidth: 1, borderColor: cores.borda }}>
                    <Text style={{ fontSize: 15, color: ativo ? cores.primaria : cores.texto, fontWeight: ativo ? '700' : '400' }}>{item.rotulo}</Text>
                    {ativo ? <Ionicons name="checkmark" size={18} color={cores.primaria} /> : null}
                  </TouchableOpacity>
                );
              }} />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
