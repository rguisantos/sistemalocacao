import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clientesParaCobrar, obterDiasAtraso, locacoesParaCobrarDoCliente } from '../../dominio/repositorios';
import { formatarBRL } from '@app/core';
import { cores, espaco, raio, fonte } from '../tema';
import { Cartao, IconeChip, StatusBadge, EmptyState } from '../componentes/kit';

const DIA = 86400000;
const LIMITE_ATRASO_PADRAO = 30; // padrão; sobrescrito pela configuração do app

function diasSemCobrar(ultimaCobranca?: string | null): number | null {
  if (!ultimaCobranca) return null;
  const t = new Date(ultimaCobranca).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DIA));
}

export function ListaCobrancaScreen({ navigation }: any) {
  const [itens, setItens] = useState<any[]>([]);
  const [limite, setLimite] = useState(LIMITE_ATRASO_PADRAO);
  useEffect(() => {
    const carregar = () => { clientesParaCobrar().then(setItens); obterDiasAtraso().then(setLimite); };
    carregar();
    return navigation.addListener('focus', carregar);
  }, [navigation]);

  async function cobrarAgora(item: any) {
    const locs = await locacoesParaCobrarDoCliente(item.id);
    if (locs.length === 1) navigation.navigate('RegistrarCobranca', { locacao: locs[0], clienteNome: item.nome });
    else navigation.navigate('Cliente', { clienteId: item.id, nome: item.nome });
  }

  const total = itens.reduce((acc, c) => acc + Number(c.total || 0), 0);

  // agrupa por rota (mantém ordem por valor dentro de cada rota); rotas ordenadas por nome
  const secoes = useMemo(() => {
    const mapa = new Map<string, { titulo: string; data: any[]; subtotal: number }>();
    for (const c of itens) {
      const chave = c.rotaNome ?? 'Sem rota';
      if (!mapa.has(chave)) mapa.set(chave, { titulo: chave, data: [], subtotal: 0 });
      const g = mapa.get(chave)!;
      g.data.push(c); g.subtotal += Number(c.total || 0);
    }
    return [...mapa.values()].sort((a, b) => a.titulo.localeCompare(b.titulo));
  }, [itens]);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <SectionList
        sections={secoes}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: espaco.lg, gap: espaco.sm }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          itens.length > 0 ? (
            <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md, marginBottom: espaco.sm }}>
              <IconeChip nome="cash" cor={cores.aviso} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: cores.suave, fontSize: 13 }}>Total a cobrar • {itens.length} cliente(s)</Text>
                <Text style={{ ...fonte.valor, fontSize: 22, color: cores.aviso }}>{formatarBRL(total.toFixed(2))}</Text>
              </View>
            </Cartao>
          ) : null
        }
        ListEmptyComponent={<EmptyState icone="checkmark-done-outline" titulo="Nada a cobrar" descricao="Nenhum cliente com saldo pendente no momento." />}
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: espaco.md, paddingBottom: espaco.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="map-outline" size={15} color={cores.suave} />
              <Text style={{ ...fonte.rotulo, color: cores.texto, fontWeight: '700' }}>{section.titulo}</Text>
            </View>
            <Text style={{ color: cores.suave, fontSize: 13 }}>{formatarBRL(section.subtotal.toFixed(2))}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const dias = diasSemCobrar(item.ultimaCobranca);
          const atrasado = dias === null || dias > limite;
          const legenda = dias === null ? 'Nunca cobrado' : dias === 0 ? 'Cobrado hoje' : `há ${dias}d`;
          return (
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Cliente', { clienteId: item.id, nome: item.nome })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md, backgroundColor: '#fff', borderRadius: raio.lg, padding: espaco.md, borderWidth: 1, borderColor: cores.borda }}>
              <IconeChip nome="person" cor={atrasado ? cores.perigo : cores.aviso} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ ...fonte.corpo, fontWeight: '600' }} numberOfLines={1}>{item.nome}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: cores.suave, fontSize: 12 }}>{item.pendencias} pendência(s)</Text>
                  {atrasado
                    ? <StatusBadge status="perigo" texto={legenda} />
                    : <Text style={{ color: cores.suave, fontSize: 12 }}>• {legenda}</Text>}
                </View>
              </View>
              <Text style={{ ...fonte.valor, fontSize: 16, color: cores.aviso }}>{formatarBRL(Number(item.total).toFixed(2))}</Text>
              <TouchableOpacity onPress={() => cobrarAgora(item)} hitSlop={8}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: cores.primariaSuave, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="cash" size={18} color={cores.primaria} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        SectionSeparatorComponent={() => <View style={{ height: 2 }} />}
        ItemSeparatorComponent={() => <View style={{ height: espaco.sm }} />}
      />
    </View>
  );
}
