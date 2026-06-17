import React, { useState } from 'react';
import { ScrollView, Text, Alert } from 'react-native';
import { pagarSaldoDevedor } from '../../dominio/repositorios';
import { obterSessao } from '../../auth/auth-storage';
import { formatarBRL } from '@app/core';
import { cores, espaco, fonte } from '../tema';
import { CampoTexto, Secao, Cartao, BotaoPrimario, IconeChip } from '../componentes/kit';
import { Selecao } from '../componentes/Selecao';

const FORMAS = [
  { id: 'DINHEIRO', rotulo: 'Dinheiro' }, { id: 'PIX_MANUAL', rotulo: 'PIX' },
  { id: 'CARTAO', rotulo: 'Cartão' }, { id: 'PIX_MERCADO_PAGO', rotulo: 'PIX (Mercado Pago)' },
];

export function QuitacaoSaldoScreen({ route, navigation }: any) {
  const saldo = route.params.saldo; // { id, produtoDescricao, valorRestante }
  const [valor, setValor] = useState(String(Number(saldo.valorRestante).toFixed(2)));
  const [forma, setForma] = useState('DINHEIRO');
  const [enviando, setEnviando] = useState(false);

  async function quitar() {
    const v = Number(valor);
    if (!v || v <= 0) return Alert.alert('Atenção', 'Informe um valor válido.');
    if (enviando) return;
    setEnviando(true);
    try {
      const sessao = await obterSessao();
      const r = await pagarSaldoDevedor(sessao!.id, saldo.id, v, forma);
      Alert.alert('Pronto', Number(r.restante) <= 0 ? 'Saldo quitado!' : `Pagamento registrado. Restante: ${formatarBRL(r.restante)}.`);
      navigation.goBack();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setEnviando(false); }
  }

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
        <IconeChip nome="alert-circle" cor={cores.aviso} />
        <Text style={{ flex: 1, ...fonte.corpo, fontWeight: '600' }}>{saldo.produtoDescricao ?? 'Saldo devedor'}</Text>
        <Text style={{ ...fonte.valor, fontSize: 18, color: cores.aviso }}>{formatarBRL(saldo.valorRestante)}</Text>
      </Cartao>
      <Secao titulo="Pagamento">
        <CampoTexto label="Valor a pagar" keyboardType="decimal-pad" value={valor} onChangeText={setValor} />
        <Selecao rotulo="Forma de pagamento" valor={forma} opcoes={FORMAS} aoSelecionar={setForma} />
      </Secao>
      <BotaoPrimario titulo="Registrar pagamento" icone="checkmark" onPress={quitar} carregando={enviando} />
    </ScrollView>
  );
}
