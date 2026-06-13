// Pagamento de saldo devedor (locação finalizada).
// Requer conexão: pagamentos de saldo não entram na fila offline
// para evitar quitação dupla entre aparelhos.
import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { db } from '../../../src/db/schema';
import { api } from '../../../src/services/api';
import { sincronizar, estaOnline } from '../../../src/services/sync';
import { formatarBRL } from '@locacoes/shared';
import { criarEstilos } from '../../../src/theme';

interface SaldoRow {
  id: string; valor_original: string; valor_restante: string; status: string;
  cliente_nome: string; plaqueta: string;
}
interface PagamentoRow {
  id: string; valor: string; forma_pagamento: string; data_pagamento: string;
}

const NOME_FORMA: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX_MANUAL: 'PIX', CARTAO: 'Cartão', PIX_MERCADO_PAGO: 'PIX QR',
};

const FORMAS = [['DINHEIRO', 'Dinheiro'], ['PIX_MANUAL', 'PIX manual'], ['CARTAO', 'Cartão']] as const;

export default function SaldoScreen() {
  const s = useEstilos();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [saldo, setSaldo] = useState<SaldoRow | null>(null);
  const [pagamentos, setPagamentos] = useState<PagamentoRow[]>([]);
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState('DINHEIRO');
  const [salvando, setSalvando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const row = db.getFirstSync<SaldoRow>(
        `SELECT s.*, c.nome AS cliente_nome, p.plaqueta
         FROM saldos_devedores s
         JOIN clientes c ON c.id = s.cliente_id
         JOIN locacoes l ON l.id = s.locacao_id
         JOIN produtos p ON p.id = l.produto_id
         WHERE s.id = ?`,
        [id]
      );
      setSaldo(row);
      setPagamentos(
        db.getAllSync<PagamentoRow>(
          `SELECT id, valor, forma_pagamento, data_pagamento
           FROM pagamentos_saldo WHERE saldo_id = ? ORDER BY data_pagamento DESC`,
          [id]
        )
      );
    }, [id])
  );

  async function pagar() {
    if (!saldo || !valor) return;
    if (!(await estaOnline())) {
      Alert.alert('Sem conexão', 'O pagamento de saldo devedor exige internet para evitar quitação duplicada entre aparelhos.');
      return;
    }
    setSalvando(true);
    try {
      await api(`/api/locacoes/saldos/${saldo.id}/pagamentos`, {
        method: 'POST',
        body: JSON.stringify({ valor: valor.replace(',', '.'), formaPagamento: forma }),
      });
      await sincronizar(); // traz o saldo atualizado para o banco local
      Alert.alert('Pagamento registrado', '', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao registrar pagamento');
    } finally {
      setSalvando(false);
    }
  }

  if (!saldo) return <Text style={s.vazio}>Carregando…</Text>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={s.cliente}>{saldo.cliente_nome}</Text>
      <Text style={s.detalhe}>Locação finalizada · {saldo.plaqueta}</Text>

      <View style={s.cartao}>
        <Text style={s.rotulo}>Valor restante</Text>
        <Text style={s.restante}>{formatarBRL(saldo.valor_restante)}</Text>
        <Text style={s.original}>de {formatarBRL(saldo.valor_original)} originais</Text>
      </View>

      <Text style={s.label}>Valor do pagamento (R$)</Text>
      <TextInput
        style={s.input} keyboardType="decimal-pad" value={valor} onChangeText={setValor}
        placeholder={saldo.valor_restante}
      />

      <Text style={s.label}>Forma de pagamento</Text>
      <View style={s.formas}>
        {FORMAS.map(([v, r]) => (
          <Pressable key={v} style={[s.chip, forma === v && s.chipAtivo]} onPress={() => setForma(v)}>
            <Text style={[s.chipTexto, forma === v && s.chipTextoAtivo]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={[s.botao, (!valor || salvando) && s.botaoOff]} disabled={!valor || salvando} onPress={pagar}>
        <Text style={s.botaoTexto}>{salvando ? 'Registrando…' : 'Registrar pagamento'}</Text>
      </Pressable>

      {pagamentos.length > 0 && (
        <>
          <Text style={[s.label, { marginTop: 24 }]}>Pagamentos desta dívida</Text>
          {pagamentos.map((p) => (
            <View key={p.id} style={s.pagamento}>
              <View>
                <Text style={s.pagamentoData}>
                  {new Date(p.data_pagamento).toLocaleDateString('pt-BR')}
                </Text>
                <Text style={s.pagamentoForma}>{NOME_FORMA[p.forma_pagamento] ?? p.forma_pagamento}</Text>
              </View>
              <Text style={s.pagamentoValor}>{formatarBRL(p.valor)}</Text>
            </View>
          ))}
          <Text style={s.dicaSync}>Pagamentos feitos em outros aparelhos aparecem após sincronizar.</Text>
        </>
      )}
    </ScrollView>
  );
}

const useEstilos = criarEstilos((c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.fundo },
  cliente: { fontSize: 20, fontWeight: '800', color: c.primaria },
  detalhe: { color: c.textoSuave, marginBottom: 16 },
  cartao: { backgroundColor: c.cartao, borderRadius: 12, padding: 18, alignItems: 'center', marginBottom: 16 },
  rotulo: { color: c.textoFraco, fontSize: 12, textTransform: 'uppercase' },
  restante: { fontSize: 30, fontWeight: '800', color: c.erro, marginVertical: 4 },
  original: { color: c.textoFraco, fontSize: 12 },
  label: { fontWeight: '600', color: c.textoSuave, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: c.cartao, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  formas: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: c.primaria, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipAtivo: { backgroundColor: c.primaria },
  chipTexto: { color: c.primaria, fontSize: 13 },
  chipTextoAtivo: { color: c.brancoFixo },
  botao: { backgroundColor: c.primaria, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  botaoOff: { opacity: 0.4 },
  botaoTexto: { color: c.brancoFixo, fontWeight: '700', fontSize: 16 },
  vazio: { textAlign: 'center', marginTop: 40, color: c.textoFraco },
  pagamento: { backgroundColor: c.cartao, borderRadius: 10, padding: 12, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pagamentoData: { fontWeight: '600', color: c.texto },
  pagamentoForma: { color: c.textoFraco, fontSize: 12 },
  pagamentoValor: { fontWeight: '800', color: c.primaria, fontSize: 16 },
  dicaSync: { color: c.textoFraco, fontSize: 11, marginTop: 8, textAlign: 'center' },
}));
