// Edição de cliente em campo — offline-first.
// PENDING_CREATE permanece PENDING_CREATE (ainda não existe no servidor);
// SYNCED vira PENDING_UPDATE. base_version é PRESERVADA para o
// fast-forward/auto-merge funcionarem no push.
import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { db } from '../../../src/db/schema';
import { sincronizar } from '../../../src/services/sync';

export default function ClienteEditarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const c = db.getFirstSync<any>(`SELECT * FROM clientes WHERE id = ?`, [id]);
      if (!c) return;
      setNome(c.nome ?? '');
      setObservacoes(c.observacoes ?? '');
      try {
        const tels = JSON.parse(c.telefones || '[]');
        setTelefone(tels[0]?.numero ?? '');
      } catch { /* telefones malformado: ignora */ }
    }, [id])
  );

  function salvar() {
    if (nome.trim().length < 2) return;
    setSalvando(true);
    try {
      const telefones = telefone.trim()
        ? JSON.stringify([{ numero: telefone.trim(), tipo: 'celular' }])
        : '[]';

      db.runSync(
        `UPDATE clientes SET
           nome = ?, telefones = ?, observacoes = ?,
           version = ?,
           sync_status = CASE WHEN sync_status = 'PENDING_CREATE'
                              THEN 'PENDING_CREATE' ELSE 'PENDING_UPDATE' END
         WHERE id = ?`,
        [nome.trim(), telefones, observacoes.trim() || null, Date.now(), id]
      );
      // base_version intencionalmente intocada: é a referência do servidor

      sincronizar();
      Alert.alert('Cliente atualizado', 'Alteração na fila de sincronização.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.label}>Nome *</Text>
      <TextInput style={s.input} value={nome} onChangeText={setNome} />
      <Text style={s.label}>Telefone</Text>
      <TextInput style={s.input} keyboardType="phone-pad" value={telefone} onChangeText={setTelefone} />
      <Text style={s.label}>Observações</Text>
      <TextInput style={[s.input, s.area]} multiline value={observacoes} onChangeText={setObservacoes} />
      <Text style={s.dica}>
        Observações são mescladas automaticamente em caso de edição simultânea no painel.
        Alterações conflitantes no nome vão para a fila de revisão.
      </Text>

      <Pressable style={[s.botao, (nome.trim().length < 2 || salvando) && s.botaoOff]}
        disabled={nome.trim().length < 2 || salvando} onPress={salvar}>
        <Text style={s.botaoTexto}>{salvando ? 'Salvando…' : 'Salvar alterações'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ea' },
  label: { fontWeight: '600', color: '#444', marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  area: { minHeight: 80, textAlignVertical: 'top' },
  dica: { color: '#999', fontSize: 12, marginTop: 8 },
  botao: { backgroundColor: '#1b5e3f', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  botaoOff: { opacity: 0.4 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
