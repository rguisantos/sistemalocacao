// apps/mobile/app/(app)/locacao-nova/[clienteId].tsx
// Nova locação em campo (relocação/instalação) — offline-first.
// O servidor revalida tudo no push (produto disponível, endereço do cliente).
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { db } from '../../../src/db/schema';
import { uuid, sincronizar } from '../../../src/services/sync';
import { criarEstilos } from '../../../src/theme';

interface ProdutoRow { id: string; plaqueta: string; contador: number }
interface EnderecoRow { id: string; logradouro: string; numero: string; bairro: string }

const REGRAS = [
  ['VALOR_FIXO', 'Valor fixo'],
  ['PERCENTUAL_A_RECEBER', '% a receber'],
  ['PERCENTUAL_A_PAGAR', '% a pagar'],
] as const;
const FREQUENCIAS = [['SEMANAL', 'Semanal'], ['QUINZENAL', 'Quinzenal'], ['MENSAL', 'Mensal']] as const;

export default function LocacaoNovaScreen() {
  const s = useEstilos();
  const { clienteId } = useLocalSearchParams<{ clienteId: string }>();
  const [clienteNome, setClienteNome] = useState('');
  const [produtos, setProdutos] = useState<ProdutoRow[]>([]);
  const [enderecos, setEnderecos] = useState<EnderecoRow[]>([]);
  const [produtoId, setProdutoId] = useState('');
  const [enderecoId, setEnderecoId] = useState('');
  const [regra, setRegra] = useState<(typeof REGRAS)[number][0]>('VALOR_FIXO');
  const [frequencia, setFrequencia] = useState('MENSAL');
  const [valorFixo, setValorFixo] = useState('');
  const [valorPartida, setValorPartida] = useState('');
  const [percentual, setPercentual] = useState('50');
  const [contadorInicial, setContadorInicial] = useState('');
  const [salvando, setSalvando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const c = db.getFirstSync<{ nome: string }>(`SELECT nome FROM clientes WHERE id = ?`, [clienteId]);
      setClienteNome(c?.nome ?? '');
      // Produtos sem locação ativa (disponíveis ou em depósito)
      setProdutos(
        db.getAllSync<ProdutoRow>(
          `SELECT p.id, p.plaqueta, p.contador FROM produtos p
           WHERE p.is_deleted = 0 AND NOT EXISTS (
             SELECT 1 FROM locacoes l
             WHERE l.produto_id = p.id AND l.status = 'ATIVA' AND l.is_deleted = 0
           )
           ORDER BY p.plaqueta`
        )
      );
      const ends = db.getAllSync<EnderecoRow>(
        `SELECT id, logradouro, numero, bairro FROM enderecos
         WHERE cliente_id = ? AND is_deleted = 0`,
        [clienteId]
      );
      setEnderecos(ends);
      if (ends.length === 1) setEnderecoId(ends[0].id);
    }, [clienteId])
  );

  const ehPercentual = regra !== 'VALOR_FIXO';
  const produto = useMemo(() => produtos.find((p) => p.id === produtoId), [produtos, produtoId]);

  const valido =
    produtoId && enderecoId && contadorInicial !== '' &&
    (ehPercentual ? !!valorPartida && !!percentual : !!valorFixo);

  function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      const id = uuid();
      const agora = Date.now();
      const contador = parseInt(contadorInicial, 10) || 0;

      db.withTransactionSync(() => {
        db.runSync(
          `INSERT INTO locacoes
           (id, produto_id, cliente_id, endereco_id, regra, frequencia,
            valor_fixo, valor_partida, percentual, contador_inicial,
            data_inicio, status, saldo_atual, is_deleted, version, base_version, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ATIVA', '0', 0, ?, 0, 'PENDING_CREATE')`,
          [
            id, produtoId, clienteId, enderecoId, regra,
            regra === 'VALOR_FIXO' ? frequencia : null,
            regra === 'VALOR_FIXO' ? valorFixo.replace(',', '.') : null,
            ehPercentual ? valorPartida.replace(',', '.') : null,
            // percentual entra como fração: 50 → 0.5
            ehPercentual ? String(Number(percentual.replace(',', '.')) / 100) : null,
            contador, new Date().toISOString(), agora,
          ]
        );
        db.runSync(`UPDATE produtos SET contador = ?, version = ? WHERE id = ?`, [
          contador, agora, produtoId,
        ]);
      });

      sincronizar();
      Alert.alert('Locação criada', 'Será validada e sincronizada com o servidor.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao criar locação');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={s.cliente}>{clienteNome}</Text>

      <Text style={s.secao}>Produto (disponível/depósito) *</Text>
      <View style={s.chips}>
        {produtos.map((p) => (
          <Pressable key={p.id}
            style={[s.chip, produtoId === p.id && s.chipAtivo]}
            onPress={() => { setProdutoId(p.id); setContadorInicial(String(p.contador)); }}>
            <Text style={[s.chipTexto, produtoId === p.id && s.chipTextoAtivo]}>{p.plaqueta}</Text>
          </Pressable>
        ))}
        {produtos.length === 0 && <Text style={s.dica}>Nenhum produto disponível. Sincronize ou finalize uma locação.</Text>}
      </View>

      <Text style={s.secao}>Endereço de instalação *</Text>
      <View style={s.chips}>
        {enderecos.map((e) => (
          <Pressable key={e.id}
            style={[s.chip, enderecoId === e.id && s.chipAtivo]}
            onPress={() => setEnderecoId(e.id)}>
            <Text style={[s.chipTexto, enderecoId === e.id && s.chipTextoAtivo]}>
              {e.logradouro}, {e.numero} – {e.bairro}
            </Text>
          </Pressable>
        ))}
      </View>

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
          <Text style={s.label}>Valor fixo (R$) *</Text>
          <TextInput style={s.input} keyboardType="decimal-pad" value={valorFixo} onChangeText={setValorFixo} />
        </>
      ) : (
        <>
          <Text style={s.label}>Valor da partida (R$) *</Text>
          <TextInput style={s.input} keyboardType="decimal-pad" value={valorPartida} onChangeText={setValorPartida} />
          <Text style={s.label}>Percentual (%) *</Text>
          <TextInput style={s.input} keyboardType="decimal-pad" value={percentual} onChangeText={setPercentual} />
        </>
      )}

      <Text style={s.label}>Contador inicial *</Text>
      <TextInput style={s.input} keyboardType="number-pad" value={contadorInicial}
        onChangeText={(t) => setContadorInicial(t.replace(/\D/g, ''))} />
      {produto && contadorInicial !== '' && parseInt(contadorInicial, 10) !== produto.contador && (
        <Text style={s.alerta}>
          ⚠ Difere do registrado ({produto.contador}). O contador do produto será atualizado.
        </Text>
      )}

      <Pressable style={[s.botao, (!valido || salvando) && s.botaoOff]} disabled={!valido || salvando} onPress={salvar}>
        <Text style={s.botaoTexto}>{salvando ? 'Criando…' : 'Criar locação'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const useEstilos = criarEstilos((c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.fundo },
  cliente: { fontSize: 20, fontWeight: '800', color: c.primaria, marginBottom: 4 },
  secao: { fontWeight: '700', color: c.textoSuave, marginTop: 16, marginBottom: 8 },
  label: { fontWeight: '600', color: c.textoSuave, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: c.cartao, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: c.primaria, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  chipAtivo: { backgroundColor: c.primaria },
  chipTexto: { color: c.primaria, fontSize: 13 },
  chipTextoAtivo: { color: c.brancoFixo },
  dica: { color: c.textoFraco, fontSize: 13 },
  alerta: { color: c.aviso, fontSize: 12, marginTop: 6 },
  botao: { backgroundColor: c.primaria, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  botaoOff: { opacity: 0.4 },
  botaoTexto: { color: c.brancoFixo, fontWeight: '700', fontSize: 16 },
}));
