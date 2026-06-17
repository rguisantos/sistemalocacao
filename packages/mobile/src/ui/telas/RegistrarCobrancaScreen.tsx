import React, { useState } from 'react';
import { View, Text, Switch, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registrarCobrancaLocal } from '../../dominio/cobranca-local';
import { gerarReciboPdf } from '../../dominio/impressao';
import { DadosRecibo } from '../../dominio/recibo';
import { obterSessao } from '../../auth/auth-storage';
import { formatarBRL } from '@app/core';
import { cores, espaco, raio, fonte } from '../tema';
import { CampoTexto, Secao, Cartao, BotaoPrimario, IconeChip, StatusBadge } from '../componentes/kit';
import { Selecao } from '../componentes/Selecao';

const FORMAS = [
  { id: 'DINHEIRO', rotulo: 'Dinheiro' }, { id: 'PIX_MANUAL', rotulo: 'PIX' },
  { id: 'CARTAO', rotulo: 'Cartão' }, { id: 'PIX_MERCADO_PAGO', rotulo: 'PIX (Mercado Pago)' },
];

export function RegistrarCobrancaScreen({ route, navigation }: any) {
  const locacao = route.params.locacao;
  const ehPercentual = locacao.regra !== 'VALOR_FIXO';
  const [contador, setContador] = useState(''); const [valorPago, setValorPago] = useState('');
  const [forma, setForma] = useState('DINHEIRO'); const [trocaPano, setTrocaPano] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [enviando, setEnviando] = useState(false);

  async function registrar() {
    if (enviando || resultado) return;
    setEnviando(true);
    try {
      const sessao = await obterSessao();
      const r = await registrarCobrancaLocal(sessao!.id, locacao, {
        contadorAtual: ehPercentual ? Number(contador) : undefined,
        trocaPano,
        pagamento: valorPago ? { valor: Number(valorPago), formaPagamento: forma } : undefined,
      });
      setResultado(r);
      if (r.alertaPagamentoInferior) Alert.alert('Atenção', 'O valor pago é inferior ao devido ao cliente. Confirme se está correto.');
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setEnviando(false); }
  }

  function montarRecibo(): DadosRecibo {
    return {
      empresa: 'Locações e Cobranças', dataISO: new Date().toISOString(),
      cliente: route.params.clienteNome ?? '—',
      produto: `${locacao.plaqueta} ${locacao.produtoDescricao ?? ''}`.trim(),
      memorial: resultado.memorial, valorLiquidoFinal: resultado.valorLiquidoFinal,
      valorRecebido: valorPago || undefined, formaPagamento: forma, trocaPano,
    };
  }

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
        <IconeChip nome="albums" cor={cores.primaria} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...fonte.corpo, fontWeight: '600' }}>{locacao.plaqueta} {locacao.produtoDescricao ?? ''}</Text>
          <Text style={{ color: cores.suave, fontSize: 13 }}>{locacao.regra}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: cores.suave, fontSize: 12 }}>Saldo anterior</Text>
          <Text style={{ ...fonte.valor, fontSize: 16 }}>{formatarBRL(locacao.saldoDevedorAtual)}</Text>
        </View>
      </Cartao>

      <Secao>
        {ehPercentual && <CampoTexto label="Contador atual" keyboardType="number-pad" value={contador} onChangeText={setContador} />}
        <CampoTexto label="Valor recebido/pago" keyboardType="decimal-pad" value={valorPago} onChangeText={setValorPago} />
        <Selecao rotulo="Forma de pagamento" valor={forma} opcoes={FORMAS} aoSelecionar={setForma} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={fonte.corpo}>Troca de pano</Text>
          <Switch value={trocaPano} onValueChange={setTrocaPano} trackColor={{ true: cores.primaria }} />
        </View>
      </Secao>

      {!resultado && <BotaoPrimario titulo="Calcular e registrar" icone="calculator" onPress={registrar} carregando={enviando} />}

      {resultado && (
        <Cartao style={{ gap: espaco.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={fonte.secao}>Resultado</Text>
            <StatusBadge status="sucesso" texto="Registrado" />
          </View>
          {resultado.memorial.map((p: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: cores.suave }}>{p.rotulo}</Text><Text style={{ color: cores.texto }}>{p.valor}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: cores.borda, paddingTop: espaco.sm, marginTop: 4 }}>
            <Text style={{ fontWeight: '700' }}>Líquido final</Text>
            <Text style={{ ...fonte.valor, fontSize: 18, color: cores.primaria }}>{formatarBRL(resultado.valorLiquidoFinal)}</Text>
          </View>
          <View style={{ gap: espaco.sm, marginTop: espaco.sm }}>
            <TouchableOpacity onPress={() => gerarReciboPdf(montarRecibo()).catch((e) => Alert.alert('Recibo', e.message))}
              style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: cores.primaria, borderRadius: raio.md, paddingVertical: 12 }}>
              <Ionicons name="document-text-outline" size={18} color={cores.primaria} />
              <Text style={{ color: cores.primaria, fontWeight: '700' }}>Ver recibo (PDF)</Text>
            </TouchableOpacity>
            <BotaoPrimario titulo="Concluir" icone="checkmark" onPress={() => navigation.goBack()} />
          </View>
        </Cartao>
      )}
    </ScrollView>
  );
}
