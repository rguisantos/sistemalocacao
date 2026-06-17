import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { finalizarLocacao, listarDepositos } from '../../dominio/repositorios';
import { formatarBRL } from '@app/core';
import { cores, espaco, raio, fonte } from '../tema';
import { Cartao, Secao, BotaoPrimario, IconeChip, StatusBadge } from '../componentes/kit';
import { Selecao } from '../componentes/Selecao';

export function FinalizarLocacaoScreen({ route, navigation }: any) {
  const l = route.params.locacao; // { id, plaqueta, produtoDescricao, saldoDevedorAtual }
  const [tipo, setTipo] = useState<'DEPOSITO' | 'RELOCACAO'>('DEPOSITO');
  const [depositoId, setDepositoId] = useState<string | undefined>();
  const [depositos, setDepositos] = useState<any[]>([]);
  const [enviando, setEnviando] = useState(false);
  const saldo = Number(l.saldoDevedorAtual ?? 0);

  useEffect(() => { listarDepositos().then(setDepositos); }, []);

  function confirmar() {
    if (tipo === 'DEPOSITO' && depositos.length > 0 && !depositoId) return Alert.alert('Atenção', 'Selecione o depósito de destino.');
    const msg = `O produto ${l.plaqueta} será liberado para nova locação.` + (saldo > 0 ? `\n\nO saldo de ${formatarBRL(saldo)} passa a ser saldo devedor do cliente (cobrável depois).` : '');
    Alert.alert('Finalizar locação', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Finalizar', style: 'destructive', onPress: async () => {
        if (enviando) return;
        setEnviando(true);
        try {
          const r = await finalizarLocacao(l.id, { tipo, depositoId });
          Alert.alert('Pronto', r.saldoGerado
            ? `Locação finalizada. Saldo devedor de ${formatarBRL(r.valor)} mantido. Produto liberado.`
            : 'Locação finalizada. Produto liberado para nova locação.');
          navigation.goBack();
        } catch (e: any) { setEnviando(false); Alert.alert('Erro', e.message); }
      } },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
        <IconeChip nome="albums" cor={cores.primaria} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...fonte.corpo, fontWeight: '600' }}>{l.plaqueta} {l.produtoDescricao ?? ''}</Text>
          <Text style={{ color: cores.suave, fontSize: 13 }}>Encerrar esta locação</Text>
        </View>
        {saldo > 0 ? <StatusBadge status="aviso" texto={`Saldo ${formatarBRL(saldo)}`} /> : <StatusBadge status="sucesso" texto="Sem saldo" />}
      </Cartao>

      <Secao titulo="Destino">
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          {([['DEPOSITO', 'Depósito'], ['RELOCACAO', 'Relocação']] as const).map(([id, lbl]) => (
            <Text key={id} onPress={() => setTipo(id)}
              style={{ flex: 1, textAlign: 'center', paddingVertical: 12, borderRadius: raio.md, overflow: 'hidden', fontWeight: '600', color: tipo === id ? '#fff' : cores.primaria, backgroundColor: tipo === id ? cores.primaria : cores.primariaSuave }}>
              {lbl}
            </Text>
          ))}
        </View>
        {tipo === 'DEPOSITO' && depositos.length > 0 && (
          <Selecao rotulo="Depósito" valor={depositoId} opcoes={depositos.map((d) => ({ id: d.id, rotulo: d.nome }))} aoSelecionar={setDepositoId} />
        )}
        {tipo === 'RELOCACAO' && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: cores.infoSuave, padding: espaco.md, borderRadius: raio.md }}>
            <Ionicons name="information-circle" size={18} color={cores.info} />
            <Text style={{ color: cores.info, flex: 1, fontSize: 13 }}>Após finalizar, crie o novo cliente e a nova locação deste mesmo produto — ele já estará liberado, mesmo sem internet.</Text>
          </View>
        )}
      </Secao>

      <BotaoPrimario titulo="Finalizar locação" icone="flag" onPress={confirmar} carregando={enviando} />
    </ScrollView>
  );
}
