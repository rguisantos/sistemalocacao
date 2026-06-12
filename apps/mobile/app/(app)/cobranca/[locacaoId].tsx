// apps/mobile/app/(app)/cobranca/[locacaoId].tsx
// Tela central do cobrador: calcula com o engine compartilhado,
// registra offline e gera recibo/QR PIX.
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Switch,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { db } from '../../../src/db/schema';
import { useApp } from '../../../src/store/app';
import {
  calcularPrevia, registrarCobrancaLocal, type LocacaoLocal,
} from '../../../src/services/cobrancaLocal';
import { sincronizar, estaOnline } from '../../../src/services/sync';
import { imprimirRecibo } from '../../../src/services/impressora';
import { api } from '../../../src/services/api';
import { formatarBRL, PERMISSOES } from '@locacoes/shared';

const FORMAS = ['DINHEIRO', 'PIX_MANUAL', 'CARTAO', 'PIX_MERCADO_PAGO'] as const;
const NOME_FORMA: Record<string, string> = {
  DINHEIRO: 'Dinheiro',
  PIX_MANUAL: 'PIX manual',
  CARTAO: 'Cartão',
  PIX_MERCADO_PAGO: 'PIX QR Code',
};

export default function CobrancaScreen() {
  const { locacaoId } = useLocalSearchParams<{ locacaoId: string }>();
  const { usuario, temPermissao } = useApp();

  const [locacao, setLocacao] = useState<(LocacaoLocal & { cliente_nome: string; plaqueta: string }) | null>(null);
  const [contadorAtual, setContadorAtual] = useState('');
  const [descontoPartidas, setDescontoPartidas] = useState('0');
  const [acrescimo, setAcrescimo] = useState('0');
  const [descontoValor, setDescontoValor] = useState('0');
  const [valorPago, setValorPago] = useState('');
  const [forma, setForma] = useState<(typeof FORMAS)[number]>('DINHEIRO');
  const [trocaPano, setTrocaPano] = useState(false);
  const [pixCopiaCola, setPixCopiaCola] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [outroCobrando, setOutroCobrando] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const row = db.getFirstSync<any>(
        `SELECT l.*, c.nome AS cliente_nome, p.plaqueta
         FROM locacoes l
         JOIN clientes c ON c.id = l.cliente_id
         JOIN produtos p ON p.id = l.produto_id
         WHERE l.id = ?`,
        [locacaoId]
      );
      setLocacao(row);

      // Bloqueio lógico (spec §6.2): quando online, sinaliza que esta
      // locação está aberta e avisa se outro cobrador também a abriu.
      // Offline: segue normalmente (idempotência + conflitos protegem).
      let ativo = true;
      (async () => {
        if (!(await estaOnline())) return;
        try {
          const r = await api<{ outroUsuario: { nome: string } | null }>(
            `/api/locacoes/${locacaoId}/sinalizar-cobranca`, { method: 'POST' }
          );
          if (ativo) setOutroCobrando(r.outroUsuario?.nome ?? null);
        } catch { /* sinalização é melhor-esforço */ }
      })();

      return () => {
        ativo = false;
        // libera ao sair da tela (melhor-esforço)
        api(`/api/locacoes/${locacaoId}/sinalizar-cobranca`, { method: 'DELETE' }).catch(() => {});
      };
    }, [locacaoId])
  );

  const ehPercentual = locacao && locacao.regra !== 'VALOR_FIXO';

  // Cálculo reativo com o MESMO engine do servidor
  const previa = useMemo(() => {
    if (!locacao) return null;
    if (ehPercentual && !contadorAtual) return null;
    try {
      return calcularPrevia(locacao, {
        contadorAtual: contadorAtual ? parseInt(contadorAtual, 10) : undefined,
        descontoPartidas: parseInt(descontoPartidas, 10) || 0,
        acrescimo: acrescimo || '0',
        descontoValorReceber: descontoValor || '0',
      });
    } catch {
      return null;
    }
  }, [locacao, contadorAtual, descontoPartidas, acrescimo, descontoValor]);

  const erros = previa && 'erros' in previa ? previa.erros : [];

  async function confirmar() {
    if (!locacao || !previa || !usuario) return;
    if (!valorPago && forma !== 'PIX_MERCADO_PAGO') {
      Alert.alert('Informe o valor recebido');
      return;
    }
    setSalvando(true);
    try {
      const pago = forma === 'PIX_MERCADO_PAGO' ? previa.valorLiquidoFinal : valorPago.replace(',', '.');
      const resultado = registrarCobrancaLocal(locacao, usuario.id, {
        contadorAtual: contadorAtual ? parseInt(contadorAtual, 10) : undefined,
        descontoPartidas: parseInt(descontoPartidas, 10) || 0,
        acrescimo,
        descontoValorReceber: descontoValor,
        valorRecebidoPago: pago,
        formaPagamento: forma,
        trocaPano,
      });

      if (resultado.alerta) Alert.alert('Atenção', resultado.alerta);

      // PIX MP exige conexão: sincroniza e busca QR Code
      if (forma === 'PIX_MERCADO_PAGO') {
        if (!(await estaOnline())) {
          Alert.alert('PIX QR Code requer internet', 'A cobrança foi salva; gere o QR quando houver conexão.');
        } else {
          await sincronizar();
          const cobrancas = await api<any[]>(`/api/locacoes/${locacao.id}/cobrancas`);
          const sincronizada = cobrancas.find((c) => c.syncOrigemId === resultado.id);
          if (sincronizada?.pixCopiaCola) {
            setPixCopiaCola(sincronizada.pixCopiaCola);
            setSalvando(false);
            return; // mantém na tela mostrando o QR
          }
        }
      } else {
        sincronizar(); // melhor esforço, sem bloquear
      }

      Alert.alert('Cobrança registrada', `Valor: ${formatarBRL(previa.valorLiquidoFinal)}`, [
        {
          text: 'Imprimir recibo',
          onPress: () =>
            imprimirRecibo({
              empresa: 'Sistema de Locações',
              cliente: locacao.cliente_nome,
              produto: locacao.plaqueta,
              data: new Date(),
              passos: previa.passos,
              valorPago: pago,
              formaPagamento: NOME_FORMA[forma],
              cobrador: usuario.nome,
              trocaPano,
            }).then(() => router.back()),
        },
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao registrar');
    } finally {
      setSalvando(false);
    }
  }

  if (!locacao) return <Text style={s.vazio}>Carregando…</Text>;

  if (pixCopiaCola) {
    return (
      <View style={s.pixContainer}>
        <Text style={s.pixTitulo}>Pagamento PIX</Text>
        <Text style={s.pixValor}>{previa ? formatarBRL(previa.valorLiquidoFinal) : ''}</Text>
        <View style={s.qr}><QRCode value={pixCopiaCola} size={240} /></View>
        <Text style={s.pixDica}>O status atualiza automaticamente após o pagamento (webhook).</Text>
        <Pressable style={s.botao} onPress={() => router.back()}>
          <Text style={s.botaoTexto}>Concluir</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={s.cliente}>{locacao.cliente_nome}</Text>

      {outroCobrando && (
        <View style={s.avisoLock}>
          <Text style={s.avisoLockTexto}>
            ⚠ {outroCobrando} também está com esta locação aberta agora.
            Combinem quem registra para evitar cobrança duplicada.
          </Text>
        </View>
      )}
      <Text style={s.produto}>{locacao.plaqueta} · saldo atual {formatarBRL(locacao.saldo_atual)}</Text>

      {ehPercentual && (
        <>
          <Text style={s.label}>Contador anterior: {locacao.ultimo_contador ?? locacao.contador_inicial}</Text>
          <Text style={s.label}>Contador atual *</Text>
          <TextInput style={s.input} keyboardType="number-pad" value={contadorAtual} onChangeText={setContadorAtual} />
          <Text style={s.label}>Desconto de partidas</Text>
          <TextInput style={s.input} keyboardType="number-pad" value={descontoPartidas} onChangeText={setDescontoPartidas} />
        </>
      )}

      <Text style={s.label}>Acréscimo (R$)</Text>
      <TextInput style={s.input} keyboardType="decimal-pad" value={acrescimo} onChangeText={setAcrescimo} />

      {locacao.regra === 'PERCENTUAL_A_RECEBER' && (
        <>
          <Text style={s.label}>Desconto no valor (R$)</Text>
          <TextInput style={s.input} keyboardType="decimal-pad" value={descontoValor} onChangeText={setDescontoValor} />
        </>
      )}

      {erros.map((e) => <Text key={e} style={s.erro}>{e}</Text>)}

      {previa && erros.length === 0 && (
        <View style={s.resumo}>
          {previa.passos.map((p, i) => (
            <View key={i} style={s.passoLinha}>
              <Text style={s.passoDesc}>{p.descricao}</Text>
              <Text style={s.passoValor}>{p.valor}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={s.label}>Forma de pagamento</Text>
      <View style={s.formas}>
        {FORMAS.map((f) => (
          <Pressable
            key={f}
            style={[s.chip, forma === f && s.chipAtivo]}
            onPress={() => setForma(f)}
          >
            <Text style={[s.chipTexto, forma === f && s.chipTextoAtivo]}>{NOME_FORMA[f]}</Text>
          </Pressable>
        ))}
      </View>

      {forma !== 'PIX_MERCADO_PAGO' && (
        <>
          <Text style={s.label}>Valor recebido (R$) *</Text>
          <TextInput
            style={s.input} keyboardType="decimal-pad" value={valorPago} onChangeText={setValorPago}
            placeholder={previa ? previa.valorLiquidoFinal : ''}
          />
        </>
      )}

      {temPermissao(PERMISSOES.MARCAR_TROCA_PANO) && (
        <View style={s.switchLinha}>
          <Text style={s.label}>Troca de pano</Text>
          <Switch value={trocaPano} onValueChange={setTrocaPano} trackColor={{ true: '#1b5e3f' }} />
        </View>
      )}

      <Pressable
        style={[s.botao, (!previa || erros.length > 0 || salvando) && s.botaoOff]}
        disabled={!previa || erros.length > 0 || salvando}
        onPress={confirmar}
      >
        <Text style={s.botaoTexto}>{salvando ? 'Salvando…' : 'Confirmar cobrança'}</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24 }}>
        {temPermissao(PERMISSOES.EDITAR_REGRAS_LOCACAO) && (
          <Pressable onPress={() => router.push(`/(app)/locacao-editar/${locacaoId}`)}>
            <Text style={s.linkFinalizar}>Editar regras…</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.push(`/(app)/finalizar/${locacaoId}`)}>
          <Text style={s.linkFinalizar}>Finalizar locação…</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ea' },
  cliente: { fontSize: 20, fontWeight: '800', color: '#1b5e3f' },
  produto: { color: '#666', marginBottom: 16 },
  label: { fontWeight: '600', color: '#444', marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  erro: { color: '#b3261e', marginTop: 8, fontWeight: '600' },
  resumo: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginTop: 16 },
  passoLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  passoDesc: { color: '#555', flex: 1, fontSize: 13 },
  passoValor: { fontWeight: '600', fontSize: 13 },
  formas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#1b5e3f', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  chipAtivo: { backgroundColor: '#1b5e3f' },
  chipTexto: { color: '#1b5e3f', fontSize: 13 },
  chipTextoAtivo: { color: '#fff' },
  switchLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  botao: { backgroundColor: '#1b5e3f', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  botaoOff: { opacity: 0.4 },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  vazio: { textAlign: 'center', marginTop: 40, color: '#888' },
  avisoLock: { backgroundColor: '#fdecea', borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#f5c6c0' },
  avisoLockTexto: { color: '#8a1c12', fontSize: 13, fontWeight: '600' },
  linkFinalizar: { color: '#888', textAlign: 'center', marginTop: 18, textDecorationLine: 'underline', fontSize: 13 },
  pixContainer: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pixTitulo: { fontSize: 20, fontWeight: '800', color: '#1b5e3f' },
  pixValor: { fontSize: 28, fontWeight: '800', marginVertical: 12 },
  qr: { padding: 16, backgroundColor: '#fff', borderRadius: 12, elevation: 3 },
  pixDica: { color: '#666', textAlign: 'center', marginTop: 16, fontSize: 13 },
});
