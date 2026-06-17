import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { obterDiasAtraso, definirDiasAtraso } from '../../dominio/repositorios';
import { cores, espaco, raio } from '../tema';
import { CampoTexto, Secao, BotaoPrimario } from '../componentes/kit';

const PRESETS = [7, 15, 30, 60];

export function ConfiguracoesScreen({ navigation }: any) {
  const [dias, setDias] = useState('30');
  useEffect(() => { obterDiasAtraso().then((n) => setDias(String(n))); }, []);

  async function salvar() {
    const n = parseInt(dias, 10);
    if (!Number.isFinite(n) || n < 1) return Alert.alert('Atenção', 'Informe um número de dias válido.');
    await definirDiasAtraso(n);
    Alert.alert('Pronto', 'Configuração salva.');
    navigation.goBack();
  }

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <Secao titulo="Atraso de cobrança">
        <Text style={{ color: cores.suave, fontSize: 13 }}>
          Dias sem cobrar para um cliente ser sinalizado como atrasado na lista de cobrança.
        </Text>
        <CampoTexto label="Dias para considerar atraso" keyboardType="number-pad" value={dias} onChangeText={setDias} />
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          {PRESETS.map((p) => (
            <TouchableOpacity key={p} onPress={() => setDias(String(p))}
              style={{ flex: 1, paddingVertical: 10, borderRadius: raio.md, alignItems: 'center', backgroundColor: dias === String(p) ? cores.primaria : cores.primariaSuave }}>
              <Text style={{ color: dias === String(p) ? '#fff' : cores.primaria, fontWeight: '600' }}>{p}d</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Secao>
      <BotaoPrimario titulo="Salvar configurações" icone="checkmark" onPress={salvar} />
    </ScrollView>
  );
}
