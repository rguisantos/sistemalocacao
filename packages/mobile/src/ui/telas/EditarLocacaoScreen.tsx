import React, { useEffect, useState } from 'react';
import { ScrollView, Text, Alert } from 'react-native';
import { obterLocacao, atualizarLocacao, enderecosDoCliente } from '../../dominio/repositorios';
import { Selecao } from '../componentes/Selecao';
import { cores, espaco } from '../tema';
import { CampoTexto, Secao, BotaoPrimario } from '../componentes/kit';

const REGRAS = [
  { id: 'VALOR_FIXO', rotulo: 'Valor fixo' },
  { id: 'PERCENTUAL_A_RECEBER', rotulo: 'Percentual a receber' },
  { id: 'PERCENTUAL_A_PAGAR', rotulo: 'Percentual a pagar' },
];
const FREQS = [{ id: 'SEMANAL', rotulo: 'Semanal' }, { id: 'QUINZENAL', rotulo: 'Quinzenal' }, { id: 'MENSAL', rotulo: 'Mensal' }];

export function EditarLocacaoScreen({ route, navigation }: any) {
  const locacaoId: string = route.params.locacaoId;
  const [l, setL] = useState<any>(null);
  const [enderecos, setEnderecos] = useState<any[]>([]);

  useEffect(() => {
    obterLocacao(locacaoId).then(async (r: any) => {
      setL({ ...r, valorFixo: r.valorFixo ?? '', valorPartida: r.valorPartida ?? '', percentual: r.percentual ?? '' });
      const ends = await enderecosDoCliente(r.clienteId); setEnderecos(ends);
    });
  }, [locacaoId]);

  if (!l) return <Text style={{ padding: espaco.lg }}>Carregando…</Text>;
  const fixo = l.regra === 'VALOR_FIXO';

  async function salvar() {
    if (!l.enderecoId) return Alert.alert('Atenção', 'Selecione o endereço.');
    try {
      await atualizarLocacao(locacaoId, {
        regra: l.regra, enderecoId: l.enderecoId,
        frequencia: fixo ? (l.frequencia ?? 'MENSAL') : undefined,
        valorFixo: fixo ? String(l.valorFixo ?? '0') : undefined,
        valorPartida: !fixo ? String(l.valorPartida ?? '0') : undefined,
        percentual: !fixo ? String(l.percentual ?? '0') : undefined,
      });
      Alert.alert('Pronto', 'Locação atualizada.'); navigation.goBack();
    } catch (e: any) { Alert.alert('Erro', e.message); }
  }

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <Secao titulo="Locação">
        <Text style={{ color: cores.suave, fontSize: 12 }}>O produto da locação não é alterável aqui.</Text>
        <Selecao rotulo="Endereço" valor={l.enderecoId} opcoes={enderecos.map((e) => ({ id: e.id, rotulo: e.logradouro }))} aoSelecionar={(id) => setL({ ...l, enderecoId: id })} />
        <Selecao rotulo="Regra" valor={l.regra} opcoes={REGRAS} aoSelecionar={(id) => setL({ ...l, regra: id })} />
        {fixo ? (
          <>
            <Selecao rotulo="Frequência" valor={l.frequencia ?? 'MENSAL'} opcoes={FREQS} aoSelecionar={(id) => setL({ ...l, frequencia: id })} />
            <CampoTexto label="Valor fixo (R$)" keyboardType="decimal-pad" value={String(l.valorFixo ?? '')} onChangeText={(v) => setL({ ...l, valorFixo: v })} />
          </>
        ) : (
          <>
            <CampoTexto label="Valor por partida (R$)" keyboardType="decimal-pad" value={String(l.valorPartida ?? '')} onChangeText={(v) => setL({ ...l, valorPartida: v })} />
            <CampoTexto label="Percentual (%)" keyboardType="decimal-pad" value={String(l.percentual ?? '')} onChangeText={(v) => setL({ ...l, percentual: v })} />
          </>
        )}
      </Secao>
      <BotaoPrimario titulo="Salvar locação" icone="checkmark" onPress={salvar} />
    </ScrollView>
  );
}
