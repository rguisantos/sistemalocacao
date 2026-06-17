import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resumoDashboard } from '../../dominio/repositorios';
import { obterSessao } from '../../auth/auth-storage';
import { sincronizar } from '../../sync/sync-client';
import { cores, espaco, fonte } from '../tema';
import { MetricCard, QuickAction, CabecalhoSecao, Cartao, StatusBadge } from '../componentes/kit';

export function HomeScreen({ navigation }: any) {
  const [resumo, setResumo] = useState<any>(null);
  const [nome, setNome] = useState('');
  const [sincronizando, setSincronizando] = useState(false);

  const carregar = () => resumoDashboard().then(setResumo);
  useEffect(() => {
    obterSessao().then((s: any) => setNome(s?.nome ?? ''));
    carregar();
    return navigation.addListener('focus', carregar);
  }, [navigation]);

  async function sincronizarAgora() {
    setSincronizando(true);
    try { await sincronizar(); await carregar(); Alert.alert('Sincronização', 'Concluída.'); }
    catch (e: any) { Alert.alert('Sincronização', e.message); }
    finally { setSincronizando(false); }
  }

  const r = resumo ?? { clientes: 0, produtos: 0, locacoesAtivas: 0, clientesComSaldo: 0, cobrancasHoje: 0, pendentesSync: 0 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.fundo }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}
        refreshControl={<RefreshControl refreshing={sincronizando} onRefresh={sincronizarAgora} tintColor={cores.primaria} />}>
        <View>
          <Text style={{ color: cores.suave }}>Olá{nome ? ',' : ''}</Text>
          <Text style={fonte.titulo}>{nome || 'Bem-vindo'}</Text>
        </View>

        {r.pendentesSync > 0 && (
          <Cartao style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={sincronizarAgora}>
            <View style={{ gap: 4 }}>
              <StatusBadge status="aviso" texto={`${r.pendentesSync} pendente(s) de envio`} />
              <Text style={{ color: cores.suave, fontSize: 13 }}>Toque para sincronizar agora</Text>
            </View>
            <Text style={{ color: cores.primaria, fontWeight: '700' }}>{sincronizando ? '…' : 'Sincronizar'}</Text>
          </Cartao>
        )}

        <View>
          <CabecalhoSecao titulo="Resumo" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <MetricCard titulo="Cobranças hoje" valor={r.cobrancasHoje} icone="cash" cor={cores.sucesso} />
            <MetricCard titulo="Clientes com saldo" valor={r.clientesComSaldo} icone="alert-circle" cor={cores.aviso} onPress={() => navigation.navigate('RotasTab', { screen: 'ListaCobranca' })} />
            <MetricCard titulo="Locações ativas" valor={r.locacoesAtivas} icone="albums" cor={cores.info} />
            <MetricCard titulo="Produtos" valor={r.produtos} icone="cube" cor={cores.primaria} onPress={() => navigation.navigate('ProdutosTab')} />
          </View>
        </View>

        <View>
          <CabecalhoSecao titulo="Ações rápidas" />
          <View style={{ flexDirection: 'row', gap: espaco.md }}>
            <QuickAction titulo="Cobrar" icone="reader" cor={cores.primaria} onPress={() => navigation.navigate('RotasTab', { screen: 'ListaCobranca' })} />
            <QuickAction titulo="Produtos" icone="cube" cor={cores.info} onPress={() => navigation.navigate('ProdutosTab')} />
            <QuickAction titulo="Mais" icone="ellipsis-horizontal" cor={cores.acento} onPress={() => navigation.navigate('MaisTab')} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
