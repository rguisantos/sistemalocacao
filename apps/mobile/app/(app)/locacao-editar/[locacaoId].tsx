// Edição de regras da locação em campo (exige editar_regras_locacao).
// Offline-first: PENDING_UPDATE preservando base_version — divergência
// com edição simultânea no painel cai na fila de conflitos (campos críticos).
import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { db } from '../../../src/db/schema';
import { sincronizar } from '../../../src/services/sync';

const REGRAS = [
  ['VALOR_FIXO', 'Valor fixo'],
  ['PERCENTUAL_A_RECEBER', '% a receber'],
  ['PERCENTUAL_A_PAGAR', '% a pagar'],
] as const;
const FREQUENCIAS = [['SEMANAL', 'Semanal'], ['QUINZENAL', 'Quinzenal'], ['MENSAL', 'Mensal']] as const;

export default function LocacaoEditarScreen() {
  const { locacaoId } = useLocalSearchParams<{ locacaoId: string }>();
  const [contexto, setContexto] = useState('');
  const [regra, setRegra] = useState<(typeof REGRAS)[number][0]>('VALOR_FIXO');
  const [frequencia, setFrequencia] = useState('MENSAL');
  const [valorFixo, setValorFixo] = useState('');
  const [valorPartida, setValorPartida] = useState('');
  const [percentual, setPercentual] = useState('');
  const [salvando, setSalvando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const l = db.getFirstSync<any>(
        `SELECT l.*, p.plaqueta, c.nome FROM locacoes l
         JOIN produtos p ON p.id = l.produto_id
         JOIN clientes c ON c.id = l.cliente_id WHERE l.id = ?`,
        [locacaoId]
      );
      if (!l) return;
      setContexto(`${l.plaqueta} · ${l.nome}`);
      setRegra(l.regra);
      setFrequencia(l.frequencia ?? 'MENSAL');
      setValorFixo(l.valor_fixo ?? '');
      setValorPartida(l.valor_partida ?? '');
      setPercentual(l.percentual ? String(Number(l.percentual) * 100) : '');
    }, [locacaoId])
  );

  const ehPercentual = regra !== 'VALOR_FIXO';
  const valido = ehPercentual ? !!valorPartida && !!percentual : !!valorFixo;

  function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      db.runSync(
        `UPDATE locacoes SET
           regra = ?, frequencia = ?, valor_fixo = ?, valor_partida = ?, percentual = ?,
           version = ?,
           sync_status = CASE WHEN sync_status = 'PENDING_CREATE'
                              THEN 'PENDING_CREATE' ELSE 'PENDING_UPDATE' END
         WHERE id = ?`,
        [
          regra,
          regra === 'VALOR_FIXO' ? frequencia : null,
          regra === 'VALOR_FIXO' ? valorFixo.replace(',', '.') : null,
          ehPercentual ? valorPartida.replace(',', '.') : null,
          ehPercentual ? String(Number(percentual.replace(',', '.')) / 100) : null,
          Date.now(), locacaoId,
        ]
      );
      sincronizar();
      Alert.alert('Regras atualizadas', 'Cálculos futuros usarão a nova regra.', [
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
      <Text style={s.contexto}>{contexto}</Text>
      <Text style={s.aviso}>
        Alterações de regra entram em vigor na próxima cobrança e são auditadas.
        Para corrigir o contador, use o painel web (exige permissão própria).
      </Text>

      <Text style={s.secao}>Regra de cobrança</Text>
      <View style={s.chips}>
        {REGRAS.map(([v, r]) => (
          <Pressable key={v} style={[s.chip, regra === v && s.chipAtivo]} onPress={() => setRegra(v)}>
            <Text style={[s.chipTexto, regra === v && s.chipTextoAtivo]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      {regra === 'VALOR_FIXO' ? (
        <>
          <Text style={s.secao}>Frequência</Text>
          <View style={s.chips}>
            {FREQUENCIAS.map(([v, r]) => (
              <Pressable key={v} style={[s.chip, frequencia === v && s.chipAtivo]} onPress={() => setFrequencia(v)}>
                <Text style={[s.chipTexto, frequencia === v && s.chipTextoAtivo]}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>Valor fixo (R$)</Text>
          <TextInput style={s.input} keyboardType="decimal-pad" value={valorFixo} onChangeText={setValorFixo} />
        </>
      ) : (
        <>
          <Text style={s.label}>Valor da partida (R$)</Text>
          <TextInput style={s.input} keyboardType="decimal-pad" value={valorPartida} onChangeText={setValorPartida} />
          <Text style={s.label}>Percentual (%)</Text>
          <TextInput style={s.input} keyboardType="decimal-pad" value={percentual} onChangeText={setPercentual} />
        </>
      )}

      <Pressable style={[s.botao, (!valido || salvando) && s.botaoOff]} disabled={!valido || salvando} onPress={salvar}>
        <Text style={s.botaoTexto}>{salvando ? 'Salvando…' : 'Salvar regras'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ea' },
  contexto: { fontSize: 18, fontWeight: '800', color: '#1b5e3f' },
  aviso: { color: '#8a6d00', fontSize: 12, marginTop: 6, backgroundColor: '#fff3cd', padding: 10, borderRadius: 8 },
  secao: { fontWeight: '700', color: '#444', marginTop: 16, marginBottom: 8 },
  label: { fontWeight: '600', color: '#444', marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#1b5e3f', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipAtivo: { backgroundColor: '#1b5e3f' },
  chipTexto: { color: '#1b5e3f', fontSize: 13 },
  chipTextoAtivo: { color: '#fff' },
  botao: { backgroundColor: '#1b5e3f', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  botaoOff: { opacity: 0.4 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
