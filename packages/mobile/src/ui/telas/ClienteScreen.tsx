import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { abasDoCliente } from '../../dominio/repositorios';
import { formatarBRL } from '@app/core';
import { cores, espaco, raio, fonte } from '../tema';
import { Cartao, IconeChip, StatusBadge, CabecalhoSecao, BotaoPrimario, EmptyState } from '../componentes/kit';

export function ClienteScreen({ route, navigation }: any) {
  const { clienteId } = route.params;
  const [dados, setDados] = useState<{ locacoes: any[]; saldos: any[] }>({ locacoes: [], saldos: [] });
  useEffect(() => {
    const carregar = () => abasDoCliente(clienteId).then(setDados);
    carregar();
    return navigation.addListener('focus', carregar);
  }, [clienteId, navigation]);

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <View style={{ flexDirection: 'row', gap: espaco.md }}>
        <View style={{ flex: 1 }}><BotaoPrimario titulo="Nova locação" icone="add" onPress={() => navigation.navigate('NovaLocacao', { clienteId, nome: route.params.nome })} /></View>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('HistoricoCobrancas', { clienteId, nome: route.params.nome })}
          style={{ width: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: cores.primaria, borderRadius: raio.md }}>
          <Ionicons name="receipt-outline" size={22} color={cores.primaria} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('EditarCliente', { clienteId, nome: route.params.nome })}
          style={{ width: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: cores.primaria, borderRadius: raio.md }}>
          <Ionicons name="create-outline" size={22} color={cores.primaria} />
        </TouchableOpacity>
      </View>

      <View>
        <CabecalhoSecao titulo="Locações ativas" />
        {dados.locacoes.length === 0 && <EmptyState icone="albums-outline" titulo="Sem locações ativas" descricao="Toque em Nova locação para começar." />}
        <View style={{ gap: espaco.md }}>
          {dados.locacoes.map((l) => {
            const saldo = Number(l.saldoDevedorAtual);
            return (
              <Cartao key={l.id} style={{ gap: espaco.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
                  <IconeChip nome="albums" cor={cores.primaria} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...fonte.corpo, fontWeight: '600' }}>{l.plaqueta} {l.produtoDescricao ?? ''}</Text>
                    <Text style={{ color: cores.suave, fontSize: 13 }}>{l.regra}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ ...fonte.valor, fontSize: 16, color: saldo !== 0 ? cores.aviso : cores.sucesso }}>{formatarBRL(l.saldoDevedorAtual)}</Text>
                    <StatusBadge status={saldo !== 0 ? 'aviso' : 'sucesso'} texto={saldo !== 0 ? 'Pendente' : 'Em dia'} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: espaco.sm, borderTopWidth: 1, borderColor: cores.borda, paddingTop: espaco.md }}>
                  <TouchableOpacity onPress={() => navigation.navigate('RegistrarCobranca', { locacao: l, clienteNome: route.params.nome })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="cash-outline" size={18} color={cores.primaria} />
                    <Text style={{ color: cores.primaria, fontWeight: '700' }}>Cobrar</Text>
                  </TouchableOpacity>
                  <View style={{ width: 16 }} />
                  <TouchableOpacity onPress={() => navigation.navigate('EditarLocacao', { locacaoId: l.id })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="create-outline" size={18} color={cores.suave} />
                    <Text style={{ color: cores.suave }}>Editar</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => navigation.navigate('FinalizarLocacao', { locacao: { id: l.id, plaqueta: l.plaqueta, produtoDescricao: l.produtoDescricao, saldoDevedorAtual: l.saldoDevedorAtual } })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="flag-outline" size={18} color={cores.aviso} />
                    <Text style={{ color: cores.aviso }}>Finalizar</Text>
                  </TouchableOpacity>
                </View>
              </Cartao>
            );
          })}
        </View>
      </View>

      {dados.saldos.length > 0 && (
        <View>
          <CabecalhoSecao titulo="Saldos devedores" />
          <View style={{ gap: espaco.md }}>
            {dados.saldos.map((s) => (
              <Cartao key={s.id} style={{ gap: espaco.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
                  <IconeChip nome="alert-circle" cor={cores.aviso} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...fonte.corpo, fontWeight: '600' }}>{s.produtoDescricao}</Text>
                    <Text style={{ color: cores.suave, fontSize: 13 }}>Saldo finalizado</Text>
                  </View>
                  <Text style={{ ...fonte.valor, fontSize: 16, color: cores.aviso }}>{formatarBRL(s.valorRestante)}</Text>
                </View>
                <View style={{ borderTopWidth: 1, borderColor: cores.borda, paddingTop: espaco.md }}>
                  <TouchableOpacity onPress={() => navigation.navigate('QuitacaoSaldo', { saldo: { id: s.id, produtoDescricao: s.produtoDescricao, valorRestante: s.valorRestante } })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="cash-outline" size={18} color={cores.primaria} />
                    <Text style={{ color: cores.primaria, fontWeight: '700' }}>Quitar saldo</Text>
                  </TouchableOpacity>
                </View>
              </Cartao>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
