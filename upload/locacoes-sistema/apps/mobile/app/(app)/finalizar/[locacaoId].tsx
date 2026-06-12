// Finalização de locação em campo — offline-first.
// O update local vira PENDING_UPDATE; no push, o servidor executa a
// finalização oficial (cria o SaldoDevedorLocacao se houver dívida).
import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { db } from '../../../src/db/schema';
import { sincronizar } from '../../../src/services/sync';
import { formatarBRL } from '@locacoes/shared';

interface DepositoRow { id: string; nome: string }
interface LocacaoRow {
  id: string; saldo_atual: string; cliente_id: string;
  plaqueta: string; cliente_nome: string;
}

export default function FinalizarScreen() {
  const { locacaoId } = useLocalSearchParams<{ locacaoId: string }>();
  const [locacao, setLocacao] = useState<LocacaoRow | null>(null);
  const [depositos, setDepositos] = useState<DepositoRow[]>([]);
  const [tipo, setTipo] = useState<'DEPOSITO' | 'RELOCACAO'>('DEPOSITO');
  const [depositoId, setDepositoId] = useState('');
  const [salvando, setSalvando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLocacao(
        db.getFirstSync<LocacaoRow>(
          `SELECT l.id, l.saldo_atual, l.cliente_id, p.plaqueta, c.nome AS cliente_nome
           FROM locacoes l
           JOIN produtos p ON p.id = l.produto_id
           JOIN clientes c ON c.id = l.cliente_id
           WHERE l.id = ?`,
          [locacaoId]
        )
      );
      const deps = db.getAllSync<DepositoRow>(
        `SELECT id, nome FROM depositos WHERE is_deleted = 0 ORDER BY nome`
      );
      setDepositos(deps);
      if (deps.length === 1) setDepositoId(deps[0].id);
    }, [locacaoId])
  );

  const devendo = locacao ? Number(locacao.saldo_atual) > 0 : false;
  const valido = tipo === 'RELOCACAO' || !!depositoId;

  function finalizar() {
    if (!locacao || !valido) return;
    setSalvando(true);
    try {
      db.runSync(
        `UPDATE locacoes SET
           status = 'FINALIZADA', data_fim = ?, finalizacao_tipo = ?, deposito_id = ?,
           version = ?,
           sync_status = CASE WHEN sync_status = 'PENDING_CREATE'
                              THEN 'PENDING_CREATE' ELSE 'PENDING_UPDATE' END
         WHERE id = ?`,
        [
          new Date().toISOString(), tipo,
          tipo === 'DEPOSITO' ? depositoId : null,
          Date.now(), locacao.id,
        ]
      );

      sincronizar();
      const proximo = () => {
        if (tipo === 'RELOCACAO') {
          // fluxo de relocação: abre direto a criação da nova locação
          router.replace(`/(app)/locacao-nova/${locacao.cliente_id}`);
        } else {
          router.back();
        }
      };
      Alert.alert(
        'Locação finalizada',
        devendo
          ? `A dívida de ${formatarBRL(locacao.saldo_atual)} será registrada no servidor após a sincronização.`
          : tipo === 'DEPOSITO' ? 'Produto recolhido para o depósito.' : 'Produto liberado para relocação.',
        [{ text: 'OK', onPress: proximo }]
      );
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao finalizar');
    } finally {
      setSalvando(false);
    }
  }

  if (!locacao) return <Text style={s.vazio}>Carregando…</Text>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.titulo}>{locacao.plaqueta}</Text>
      <Text style={s.subtitulo}>{locacao.cliente_nome}</Text>

      {devendo && (
        <View style={s.aviso}>
          <Text style={s.avisoTexto}>
            Saldo devedor de {formatarBRL(locacao.saldo_atual)} ficará vinculado ao cliente
            como dívida pendente, cobrável depois pela tela do cliente.
          </Text>
        </View>
      )}

      <Text style={s.secao}>Destino</Text>
      <View style={s.chips}>
        {([['DEPOSITO', 'Recolher para depósito'], ['RELOCACAO', 'Relocação imediata']] as const).map(([v, r]) => (
          <Pressable key={v} style={[s.chip, tipo === v && s.chipAtivo]} onPress={() => setTipo(v)}>
            <Text style={[s.chipTexto, tipo === v && s.chipTextoAtivo]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      {tipo === 'DEPOSITO' && (
        <>
          <Text style={s.secao}>Depósito de destino *</Text>
          <View style={s.chips}>
            {depositos.map((d) => (
              <Pressable key={d.id} style={[s.chip, depositoId === d.id && s.chipAtivo]}
                onPress={() => setDepositoId(d.id)}>
                <Text style={[s.chipTexto, depositoId === d.id && s.chipTextoAtivo]}>{d.nome}</Text>
              </Pressable>
            ))}
            {depositos.length === 0 && (
              <Text style={s.dica}>Nenhum depósito sincronizado. Sincronize primeiro.</Text>
            )}
          </View>
        </>
      )}

      {tipo === 'RELOCACAO' && (
        <Text style={s.dica}>
          Ao confirmar, a tela de nova locação abre automaticamente para instalar o produto
          em outro endereço ou cliente.
        </Text>
      )}

      <Pressable style={[s.botao, (!valido || salvando) && s.botaoOff]} disabled={!valido || salvando} onPress={finalizar}>
        <Text style={s.botaoTexto}>{salvando ? 'Finalizando…' : 'Confirmar finalização'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ea' },
  titulo: { fontSize: 20, fontWeight: '800', color: '#1b5e3f' },
  subtitulo: { color: '#666', marginBottom: 12 },
  aviso: { backgroundColor: '#fff3cd', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#ffe69c' },
  avisoTexto: { color: '#8a6d00', fontSize: 13 },
  secao: { fontWeight: '700', color: '#444', marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#1b5e3f', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipAtivo: { backgroundColor: '#1b5e3f' },
  chipTexto: { color: '#1b5e3f', fontSize: 13 },
  chipTextoAtivo: { color: '#fff' },
  dica: { color: '#888', fontSize: 13, marginTop: 4 },
  botao: { backgroundColor: '#1b5e3f', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  botaoOff: { opacity: 0.4 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  vazio: { textAlign: 'center', marginTop: 40, color: '#888' },
});
