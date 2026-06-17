import React, { useEffect, useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import { criarLocacao, produtosDisponiveis, enderecosDoCliente } from '../../dominio/repositorios';
import { Selecao } from '../componentes/Selecao';
import { cores, espaco } from '../tema';
import { CampoTexto, Secao, BotaoPrimario } from '../componentes/kit';

const REGRAS = [
  { id: 'VALOR_FIXO', rotulo: 'Valor fixo' },
  { id: 'PERCENTUAL_A_RECEBER', rotulo: 'Percentual a receber' },
  { id: 'PERCENTUAL_A_PAGAR', rotulo: 'Percentual a pagar' },
];
const FREQS = [{ id: 'SEMANAL', rotulo: 'Semanal' }, { id: 'QUINZENAL', rotulo: 'Quinzenal' }, { id: 'MENSAL', rotulo: 'Mensal' }];

export function NovaLocacaoScreen({ route, navigation }: any) {
  const clienteId: string = route.params.clienteId;
  const [produtos, setProdutos] = useState<any[]>([]); const [enderecos, setEnderecos] = useState<any[]>([]);
  const [l, setL] = useState<any>({ regra: 'VALOR_FIXO', frequencia: 'MENSAL' });
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { produtosDisponiveis().then(setProdutos); enderecosDoCliente(clienteId).then(setEnderecos); }, [clienteId]);
  const fixo = l.regra === 'VALOR_FIXO';

  async function salvar() {
    if (!l.produtoId || !l.enderecoId) return Alert.alert('Atenção', 'Selecione produto e endereço.');
    if (enviando) return;
    setEnviando(true);
    try {
      await criarLocacao({
        produtoId: l.produtoId, clienteId, enderecoId: l.enderecoId, regra: l.regra,
        frequencia: fixo ? l.frequencia : undefined,
        valorFixo: fixo ? String(l.valorFixo ?? '0') : undefined,
        valorPartida: !fixo ? String(l.valorPartida ?? '0') : undefined,
        percentual: !fixo ? String(l.percentual ?? '0') : undefined,
        contadorInicial: !fixo && l.contadorInicial ? Number(l.contadorInicial) : undefined,
      });
      Alert.alert('Pronto', 'Locação criada.'); navigation.goBack();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setEnviando(false); }
  }

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <Secao titulo="Locação">
        <Selecao rotulo="Produto (sem locação ativa)" valor={l.produtoId} opcoes={produtos.map((p) => ({ id: p.id, rotulo: `${p.plaqueta} ${p.descricao ?? ''}` }))} aoSelecionar={(id) => setL({ ...l, produtoId: id })} />
        <Selecao rotulo="Endereço" valor={l.enderecoId} opcoes={enderecos.map((e) => ({ id: e.id, rotulo: e.logradouro }))} aoSelecionar={(id) => setL({ ...l, enderecoId: id })} />
        <Selecao rotulo="Regra" valor={l.regra} opcoes={REGRAS} aoSelecionar={(id) => setL({ ...l, regra: id })} />
        {fixo ? (
          <>
            <Selecao rotulo="Frequência" valor={l.frequencia} opcoes={FREQS} aoSelecionar={(id) => setL({ ...l, frequencia: id })} />
            <CampoTexto label="Valor fixo (R$)" keyboardType="decimal-pad" value={l.valorFixo ?? ''} onChangeText={(v) => setL({ ...l, valorFixo: v })} />
          </>
        ) : (
          <>
            <CampoTexto label="Valor por partida (R$)" keyboardType="decimal-pad" value={l.valorPartida ?? ''} onChangeText={(v) => setL({ ...l, valorPartida: v })} />
            <CampoTexto label="Percentual (%)" keyboardType="decimal-pad" value={l.percentual ?? ''} onChangeText={(v) => setL({ ...l, percentual: v })} />
            <CampoTexto label="Contador inicial" keyboardType="number-pad" value={l.contadorInicial ?? ''} onChangeText={(v) => setL({ ...l, contadorInicial: v })} />
          </>
        )}
      </Secao>
      <BotaoPrimario titulo="Criar locação" icone="checkmark" onPress={salvar} carregando={enviando} />
    </ScrollView>
  );
}
