import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { MapaLeaflet } from '../componentes/MapaLeaflet';
import { criarClienteComEndereco } from '../../dominio/repositorios';
import { cores, espaco, raio, fonte } from '../tema';
import { CampoTexto, Secao, BotaoPrimario } from '../componentes/kit';

export function NovoClienteScreen({ route, navigation }: any) {
  const rotaId: string = route.params.rotaId;
  const [tipo, setTipo] = useState<'PF' | 'PJ'>('PF');
  const [nome, setNome] = useState(''); const [cpfCnpj, setCpfCnpj] = useState(''); const [telefone, setTelefone] = useState('');
  const [end, setEnd] = useState<any>({});
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome || !cpfCnpj) return Alert.alert('Atenção', 'Informe nome e CPF/CNPJ.');
    if (salvando) return;
    setSalvando(true);
    try {
      await criarClienteComEndereco({ tipo, nome, cpfCnpj: cpfCnpj.replace(/\D/g, ''), rotaId, telefones: telefone ? [telefone] : [], endereco: end.logradouro ? end : undefined });
      Alert.alert('Pronto', 'Cliente salvo. Será enviado na próxima sincronização.');
      navigation.goBack();
    } catch (e: any) { Alert.alert('Erro', e.message); } finally { setSalvando(false); }
  }

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <Secao titulo="Dados">
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          {(['PF', 'PJ'] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTipo(t)} style={{ flex: 1, paddingVertical: 12, borderRadius: raio.md, alignItems: 'center', backgroundColor: tipo === t ? cores.primaria : cores.primariaSuave }}>
              <Text style={{ color: tipo === t ? '#fff' : cores.primaria, fontWeight: '600' }}>{t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <CampoTexto label="Nome / Razão social" value={nome} onChangeText={setNome} />
        <CampoTexto label="CPF / CNPJ" keyboardType="number-pad" value={cpfCnpj} onChangeText={setCpfCnpj} />
        <CampoTexto label="Telefone" keyboardType="phone-pad" value={telefone} onChangeText={setTelefone} />
      </Secao>

      <Secao titulo="Endereço">
        <CampoTexto label="Logradouro" value={end.logradouro ?? ''} onChangeText={(v) => setEnd({ ...end, logradouro: v })} />
        <View style={{ flexDirection: 'row', gap: espaco.md }}>
          <View style={{ flex: 1 }}><CampoTexto label="Número" value={end.numero ?? ''} onChangeText={(v) => setEnd({ ...end, numero: v })} /></View>
          <View style={{ flex: 1 }}><CampoTexto label="Bairro" value={end.bairro ?? ''} onChangeText={(v) => setEnd({ ...end, bairro: v })} /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: espaco.md }}>
          <View style={{ flex: 2 }}><CampoTexto label="Cidade" value={end.cidade ?? ''} onChangeText={(v) => setEnd({ ...end, cidade: v })} /></View>
          <View style={{ flex: 1 }}><CampoTexto label="UF" maxLength={2} autoCapitalize="characters" value={end.estado ?? ''} onChangeText={(v) => setEnd({ ...end, estado: v.toUpperCase() })} /></View>
        </View>
        <MapaLeaflet latitude={end.latitude} longitude={end.longitude} altura={180}
          onChange={(la, ln) => setEnd({ ...end, latitude: la, longitude: ln })} />
      </Secao>

      <BotaoPrimario titulo="Salvar cliente" icone="checkmark" onPress={salvar} carregando={salvando} />
    </ScrollView>
  );
}
