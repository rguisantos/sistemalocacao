import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { relatorioCobrancas } from '../../dominio/repositorios';
import { formatarBRL } from '@app/core';
import { cores, espaco, raio, fonte } from '../tema';
import { Cartao, MetricCard, CabecalhoSecao } from '../componentes/kit';

const PT_FORMA: Record<string, string> = { DINHEIRO: 'Dinheiro', PIX_MANUAL: 'PIX', CARTAO: 'Cartão', PIX_MERCADO_PAGO: 'PIX (Mercado Pago)' };

export function RelatorioCobrancasScreen() {
  const [periodo, setPeriodo] = useState<'hoje' | 'mes'>('hoje');
  const [dados, setDados] = useState<any>(null);

  useEffect(() => {
    const agora = new Date();
    const ini = periodo === 'hoje'
      ? new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
      : new Date(agora.getFullYear(), agora.getMonth(), 1);
    relatorioCobrancas(ini.toISOString(), agora.toISOString()).then(setDados);
  }, [periodo]);

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <View style={{ flexDirection: 'row', gap: espaco.sm }}>
        {(['hoje', 'mes'] as const).map((p) => (
          <TouchableOpacity key={p} onPress={() => setPeriodo(p)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: raio.md, alignItems: 'center', backgroundColor: periodo === p ? cores.primaria : cores.primariaSuave }}>
            <Text style={{ color: periodo === p ? '#fff' : cores.primaria, fontWeight: '600' }}>{p === 'hoje' ? 'Hoje' : 'Este mês'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <MetricCard titulo="Cobranças" valor={dados?.quantidade ?? 0} icone="receipt" cor={cores.primaria} />
        <MetricCard titulo="Recebido" valor={formatarBRL(dados?.totalRecebido ?? '0')} icone="cash" cor={cores.sucesso} />
      </View>

      <Cartao style={{ gap: 6 }}>
        <CabecalhoSecao titulo="Recebido por forma" />
        {dados && Object.keys(dados.porForma).length === 0 && <Text style={{ color: cores.suave }}>Nenhum recebimento no período.</Text>}
        {dados && Object.entries(dados.porForma).map(([forma, total]: any) => (
          <View key={forma} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: cores.suave }}>{PT_FORMA[forma] ?? forma}</Text>
            <Text>{formatarBRL(total)}</Text>
          </View>
        ))}
      </Cartao>
    </ScrollView>
  );
}
