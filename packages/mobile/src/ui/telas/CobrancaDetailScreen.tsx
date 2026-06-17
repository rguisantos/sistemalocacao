import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { cobrancaComPagamentos } from '../../dominio/repositorios';
import { formatarBRL } from '@app/core';
import { cores, espaco, fonte } from '../tema';
import { Cartao, CabecalhoSecao, StatusBadge } from '../componentes/kit';

const PT_FORMA: Record<string, string> = { DINHEIRO: 'Dinheiro', PIX_MANUAL: 'PIX', CARTAO: 'Cartão', PIX_MERCADO_PAGO: 'PIX (Mercado Pago)' };

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
      <Text style={{ color: forte ? cores.texto : cores.suave, fontWeight: forte ? '700' : '400' }}>{rotulo}</Text>
      <Text style={{ color: forte ? cores.primaria : cores.texto, fontWeight: forte ? '700' : '400' }}>{valor}</Text>
    </View>
  );
}

export function CobrancaDetailScreen({ route }: any) {
  const { cobrancaId } = route.params;
  const [dados, setDados] = useState<any>(null);
  useEffect(() => { cobrancaComPagamentos(cobrancaId).then(setDados); }, [cobrancaId]);
  if (!dados?.cobranca) return <Text style={{ padding: espaco.lg }}>Carregando…</Text>;
  const c = dados.cobranca;

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <Cartao style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...fonte.secao }}>{c.plaqueta} {c.produtoDescricao ?? ''}</Text>
          <StatusBadge status={c.statusPagamento === 'PAGO' ? 'sucesso' : c.statusPagamento === 'PARCIAL' ? 'aviso' : 'perigo'} texto={c.statusPagamento} />
        </View>
        <Text style={{ color: cores.suave, fontSize: 12 }}>{new Date(c.dataCobranca).toLocaleString('pt-BR')}</Text>
      </Cartao>

      <Cartao style={{ gap: 2 }}>
        <CabecalhoSecao titulo="Valores" />
        {c.contadorAtual != null && <Linha rotulo="Contador" valor={`${c.contadorAnterior ?? 0} → ${c.contadorAtual}`} />}
        {c.partidasConsideradas != null && <Linha rotulo="Partidas" valor={String(c.partidasConsideradas)} />}
        {c.valorPercentual && <Linha rotulo="Valor percentual" valor={formatarBRL(c.valorPercentual)} />}
        {Number(c.acrescimo) > 0 && <Linha rotulo="Acréscimo" valor={formatarBRL(c.acrescimo)} />}
        <Linha rotulo="Saldo anterior" valor={formatarBRL(c.saldoDevedorAnterior)} />
        <Linha rotulo="Líquido final" valor={formatarBRL(c.valorLiquidoFinal)} forte />
        {c.trocaPano ? <Text style={{ color: cores.suave, marginTop: 6 }}>Inclui troca de pano</Text> : null}
      </Cartao>

      <Cartao style={{ gap: 6 }}>
        <CabecalhoSecao titulo="Pagamentos" />
        {dados.pagamentos.length === 0 && <Text style={{ color: cores.suave }}>Nenhum pagamento registrado.</Text>}
        {dados.pagamentos.map((p: any) => (
          <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: cores.suave }}>{PT_FORMA[p.formaPagamento] ?? p.formaPagamento}</Text>
            <Text>{formatarBRL(p.valor)}</Text>
          </View>
        ))}
      </Cartao>
    </ScrollView>
  );
}
