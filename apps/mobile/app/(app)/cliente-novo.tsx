// apps/mobile/app/(app)/cliente-novo.tsx
// Cadastro de cliente em campo — 100% offline-first.
// Gera UUID local, grava como PENDING_CREATE e o sync envia depois.
import { useCallback, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { db } from '../../src/db/schema';
import { uuid, sincronizar } from '../../src/services/sync';

interface RotaRow { id: string; nome: string }

export default function ClienteNovoScreen() {
  const [rotas, setRotas] = useState<RotaRow[]>([]);
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [rotaId, setRotaId] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  /**
   * GPS: captura lat/long e tenta geocodificação reversa para sugerir
   * o endereço. Coordenadas são salvas mesmo sem internet (a reversa
   * pode falhar offline — campos seguem editáveis).
   */
  async function usarLocalizacao() {
    setLocalizando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Habilite a localização nas configurações para usar este recurso.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });

      try {
        const [end] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (end) {
          if (!logradouro && end.street) setLogradouro(end.street);
          if (!numero && end.streetNumber) setNumero(end.streetNumber);
          if (!bairro && end.district) setBairro(end.district);
          if (!cidade && end.city) setCidade(end.city);
          if (!estado && end.region) setEstado(end.region.slice(0, 2).toUpperCase());
          if (!cep && end.postalCode) setCep(end.postalCode.replace(/\D/g, ''));
        }
      } catch { /* sem internet: só as coordenadas */ }
    } catch (e: any) {
      Alert.alert('Erro de localização', e?.message ?? 'Não foi possível obter a posição.');
    } finally {
      setLocalizando(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      const rows = db.getAllSync<RotaRow>(
        `SELECT id, nome FROM rotas WHERE ativo = 1 AND is_deleted = 0 ORDER BY nome`
      );
      setRotas(rows);
      if (rows.length === 1) setRotaId(rows[0].id);
    }, [])
  );

  const valido =
    nome.trim().length >= 2 && rotaId &&
    logradouro.trim() && numero.trim() && bairro.trim() &&
    cidade.trim() && estado.trim().length === 2 && cep.replace(/\D/g, '').length === 8;

  function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      const clienteId = uuid();
      const enderecoId = uuid();
      const agora = Date.now();
      const telefones = telefone.trim()
        ? JSON.stringify([{ numero: telefone.trim(), tipo: 'celular' }])
        : '[]';

      db.withTransactionSync(() => {
        db.runSync(
          `INSERT INTO clientes
           (id, tipo, nome, cpf_cnpj, telefones, rota_id, ativo, is_deleted, version, base_version, sync_status)
           VALUES (?, 'PESSOA_FISICA', ?, ?, ?, ?, 1, 0, ?, 0, 'PENDING_CREATE')`,
          [clienteId, nome.trim(), cpfCnpj.trim() || null, telefones, rotaId, agora]
        );
        db.runSync(
          `INSERT INTO enderecos
           (id, cliente_id, logradouro, numero, bairro, cidade, estado, cep,
            latitude, longitude, principal, is_deleted, version, base_version, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, 0, 'PENDING_CREATE')`,
          [
            enderecoId, clienteId, logradouro.trim(), numero.trim(), bairro.trim(),
            cidade.trim(), estado.trim().toUpperCase(), cep.replace(/\D/g, ''),
            coords ? String(coords.lat) : null, coords ? String(coords.lng) : null,
            agora,
          ]
        );
      });

      sincronizar(); // melhor esforço; sem rede, fica na fila
      Alert.alert('Cliente cadastrado', 'Será sincronizado com o servidor.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar cliente');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={s.secao}>Dados do cliente</Text>
      <TextInput style={s.input} placeholder="Nome *" value={nome} onChangeText={setNome} />
      <TextInput style={s.input} placeholder="CPF/CNPJ" keyboardType="number-pad" value={cpfCnpj} onChangeText={setCpfCnpj} />
      <TextInput style={s.input} placeholder="Telefone" keyboardType="phone-pad" value={telefone} onChangeText={setTelefone} />

      <Text style={s.secao}>Rota *</Text>
      <View style={s.chips}>
        {rotas.map((r) => (
          <Pressable key={r.id} style={[s.chip, rotaId === r.id && s.chipAtivo]} onPress={() => setRotaId(r.id)}>
            <Text style={[s.chipTexto, rotaId === r.id && s.chipTextoAtivo]}>{r.nome}</Text>
          </Pressable>
        ))}
        {rotas.length === 0 && (
          <Text style={s.dica}>Sincronize primeiro para baixar as rotas.</Text>
        )}
      </View>

      <Text style={s.secao}>Endereço de instalação</Text>
      <Pressable style={s.btnGps} onPress={usarLocalizacao} disabled={localizando}>
        <Text style={s.btnGpsTexto}>
          {localizando ? 'Obtendo posição…' : coords ? '📍 Localização capturada ✓ (tocar para atualizar)' : '📍 Usar localização atual'}
        </Text>
      </Pressable>
      <TextInput style={s.input} placeholder="Logradouro *" value={logradouro} onChangeText={setLogradouro} />
      <View style={s.linha}>
        <TextInput style={[s.input, s.meio]} placeholder="Número *" value={numero} onChangeText={setNumero} />
        <TextInput style={[s.input, s.meio]} placeholder="Bairro *" value={bairro} onChangeText={setBairro} />
      </View>
      <View style={s.linha}>
        <TextInput style={[s.input, { flex: 2 }]} placeholder="Cidade *" value={cidade} onChangeText={setCidade} />
        <TextInput style={[s.input, { flex: 1 }]} placeholder="UF *" maxLength={2} autoCapitalize="characters" value={estado} onChangeText={setEstado} />
      </View>
      <TextInput style={s.input} placeholder="CEP * (somente números)" keyboardType="number-pad" maxLength={8} value={cep} onChangeText={setCep} />

      <Pressable style={[s.botao, (!valido || salvando) && s.botaoOff]} disabled={!valido || salvando} onPress={salvar}>
        <Text style={s.botaoTexto}>{salvando ? 'Salvando…' : 'Cadastrar cliente'}</Text>
      </Pressable>
      <Text style={s.rodape}>Funciona sem internet — o cadastro entra na fila de sincronização.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ea' },
  secao: { fontWeight: '700', color: '#1b5e3f', marginTop: 16, marginBottom: 8, fontSize: 15 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginBottom: 8 },
  linha: { flexDirection: 'row', gap: 8 },
  meio: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#1b5e3f', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipAtivo: { backgroundColor: '#1b5e3f' },
  chipTexto: { color: '#1b5e3f', fontSize: 13 },
  chipTextoAtivo: { color: '#fff' },
  dica: { color: '#888', fontSize: 13 },
  botao: { backgroundColor: '#1b5e3f', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  botaoOff: { opacity: 0.4 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  rodape: { color: '#999', fontSize: 12, textAlign: 'center', marginTop: 10 },
  btnGps: { backgroundColor: '#e8f3ee', borderRadius: 10, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: '#1b5e3f44' },
  btnGpsTexto: { color: '#1b5e3f', fontWeight: '600', textAlign: 'center', fontSize: 13 },
});
