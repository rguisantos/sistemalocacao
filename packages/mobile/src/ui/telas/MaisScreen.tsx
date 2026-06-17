import React, { useState } from 'react';
import { ScrollView, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { sincronizar } from '../../sync/sync-client';
import { limparSessao } from '../../auth/auth-storage';
import { cores, espaco, fonte, raio } from '../tema';
import { IconeChip } from '../componentes/kit';

export function MaisScreen({ navigation }: any) {
  const [sinc, setSinc] = useState(false);
  const itens: { icone: any; cor: string; titulo: string; onPress: () => void }[] = [
    { icone: 'construct', cor: cores.info, titulo: 'Manutenções', onPress: () => navigation.navigate('Manutencoes') },
    { icone: 'bar-chart', cor: cores.acento, titulo: 'Relatório de cobranças', onPress: () => navigation.navigate('RelatorioCobrancas') },
    { icone: 'settings', cor: cores.suave, titulo: 'Configurações', onPress: () => navigation.navigate('Configuracoes') },
    { icone: 'sync', cor: cores.sucesso, titulo: sinc ? 'Sincronizando…' : 'Sincronizar agora', onPress: async () => { setSinc(true); try { await sincronizar(); Alert.alert('Sincronização', 'Concluída.'); } catch (e: any) { Alert.alert('Sincronização', e.message); } finally { setSinc(false); } } },
    { icone: 'log-out', cor: cores.perigo, titulo: 'Sair', onPress: () => Alert.alert('Sair', 'Deseja sair?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: async () => { await limparSessao(); navigation.getParent('root' as any)?.reset({ index: 0, routes: [{ name: 'Login' }] }); } }]) },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: espaco.lg, gap: espaco.md }}>
        <Text style={fonte.titulo}>Mais</Text>
        {itens.map((it) => (
          <TouchableOpacity key={it.titulo} activeOpacity={0.7} onPress={it.onPress}
            style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md, backgroundColor: cores.superficie, borderRadius: raio.lg, padding: espaco.lg, borderWidth: 1, borderColor: cores.borda }}>
            <IconeChip nome={it.icone} cor={it.cor} />
            <Text style={{ ...fonte.corpo, fontWeight: '600', flex: 1 }}>{it.titulo}</Text>
            <Ionicons name="chevron-forward" size={18} color={cores.leve} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
