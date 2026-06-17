import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { configurarApi } from './src/sync/api';
import { API_BASE_URL } from './src/config';
import { cores } from './src/ui/tema';
import { ErrorBoundary } from './src/ui/componentes/ErrorBoundary';

import { LoginScreen } from './src/ui/telas/LoginScreen';
import { HomeScreen } from './src/ui/telas/HomeScreen';
import { MaisScreen } from './src/ui/telas/MaisScreen';
import { RotasScreen } from './src/ui/telas/RotasScreen';
import { ClientesScreen } from './src/ui/telas/ClientesScreen';
import { ClienteScreen } from './src/ui/telas/ClienteScreen';
import { RegistrarCobrancaScreen } from './src/ui/telas/RegistrarCobrancaScreen';
import { ManutencoesScreen } from './src/ui/telas/ManutencoesScreen';
import { NovoClienteScreen } from './src/ui/telas/NovoClienteScreen';
import { NovoProdutoScreen } from './src/ui/telas/NovoProdutoScreen';
import { NovaLocacaoScreen } from './src/ui/telas/NovaLocacaoScreen';
import { ProdutosScreen } from './src/ui/telas/ProdutosScreen';
import { EditarClienteScreen } from './src/ui/telas/EditarClienteScreen';
import { EditarProdutoScreen } from './src/ui/telas/EditarProdutoScreen';
import { EditarLocacaoScreen } from './src/ui/telas/EditarLocacaoScreen';
import { QuitacaoSaldoScreen } from './src/ui/telas/QuitacaoSaldoScreen';
import { HistoricoCobrancasScreen } from './src/ui/telas/HistoricoCobrancasScreen';
import { CobrancaDetailScreen } from './src/ui/telas/CobrancaDetailScreen';
import { RelatorioCobrancasScreen } from './src/ui/telas/RelatorioCobrancasScreen';
import { FinalizarLocacaoScreen } from './src/ui/telas/FinalizarLocacaoScreen';
import { ListaCobrancaScreen } from './src/ui/telas/ListaCobrancaScreen';
import { ConfiguracoesScreen } from './src/ui/telas/ConfiguracoesScreen';

configurarApi(API_BASE_URL);

const tema = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: cores.primaria, background: cores.fundo, card: '#fff', text: cores.texto, border: cores.borda },
};
const headerPadrao = {
  headerStyle: { backgroundColor: cores.primaria },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' as const },
};

const Root = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const PilhaRotas = createNativeStackNavigator();
const PilhaProdutos = createNativeStackNavigator();
const PilhaMais = createNativeStackNavigator();

function RotasStack() {
  return (
    <PilhaRotas.Navigator screenOptions={headerPadrao}>
      <PilhaRotas.Screen name="Rotas" component={RotasScreen} options={{ title: 'Rotas' }} />
      <PilhaRotas.Screen name="ListaCobranca" component={ListaCobrancaScreen} options={{ title: 'Cobranças pendentes' }} />
      <PilhaRotas.Screen name="Clientes" component={ClientesScreen} options={({ route }: any) => ({ title: route.params?.nome ?? 'Clientes' })} />
      <PilhaRotas.Screen name="Cliente" component={ClienteScreen} options={({ route }: any) => ({ title: route.params?.nome ?? 'Cliente' })} />
      <PilhaRotas.Screen name="RegistrarCobranca" component={RegistrarCobrancaScreen} options={{ title: 'Registrar cobrança' }} />
      <PilhaRotas.Screen name="NovoCliente" component={NovoClienteScreen} options={{ title: 'Novo cliente', presentation: 'modal' }} />
      <PilhaRotas.Screen name="NovaLocacao" component={NovaLocacaoScreen} options={{ title: 'Nova locação', presentation: 'modal' }} />
      <PilhaRotas.Screen name="EditarCliente" component={EditarClienteScreen} options={{ title: 'Editar cliente', presentation: 'modal' }} />
      <PilhaRotas.Screen name="EditarLocacao" component={EditarLocacaoScreen} options={{ title: 'Editar locação', presentation: 'modal' }} />
      <PilhaRotas.Screen name="QuitacaoSaldo" component={QuitacaoSaldoScreen} options={{ title: 'Quitar saldo', presentation: 'modal' }} />
      <PilhaRotas.Screen name="HistoricoCobrancas" component={HistoricoCobrancasScreen} options={{ title: 'Histórico de cobranças' }} />
      <PilhaRotas.Screen name="CobrancaDetail" component={CobrancaDetailScreen} options={{ title: 'Cobrança' }} />
      <PilhaRotas.Screen name="FinalizarLocacao" component={FinalizarLocacaoScreen} options={{ title: 'Finalizar locação', presentation: 'modal' }} />
    </PilhaRotas.Navigator>
  );
}
function ProdutosStack() {
  return (
    <PilhaProdutos.Navigator screenOptions={headerPadrao}>
      <PilhaProdutos.Screen name="Produtos" component={ProdutosScreen} options={{ title: 'Produtos' }} />
      <PilhaProdutos.Screen name="NovoProduto" component={NovoProdutoScreen} options={{ title: 'Novo produto', presentation: 'modal' }} />
      <PilhaProdutos.Screen name="EditarProduto" component={EditarProdutoScreen} options={{ title: 'Editar produto', presentation: 'modal' }} />
    </PilhaProdutos.Navigator>
  );
}
function MaisStack() {
  return (
    <PilhaMais.Navigator screenOptions={headerPadrao}>
      <PilhaMais.Screen name="Mais" component={MaisScreen} options={{ headerShown: false }} />
      <PilhaMais.Screen name="Manutencoes" component={ManutencoesScreen} options={{ title: 'Manutenções' }} />
      <PilhaMais.Screen name="RelatorioCobrancas" component={RelatorioCobrancasScreen} options={{ title: 'Relatório de cobranças' }} />
      <PilhaMais.Screen name="Configuracoes" component={ConfiguracoesScreen} options={{ title: 'Configurações' }} />
    </PilhaMais.Navigator>
  );
}

function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.suave,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: cores.borda, height: 60, paddingBottom: 8, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        tabBarIcon: ({ color, size, focused }) => {
          const mapa: Record<string, [any, any]> = {
            Inicio: ['home', 'home-outline'],
            RotasTab: ['map', 'map-outline'],
            ProdutosTab: ['cube', 'cube-outline'],
            MaisTab: ['menu', 'menu-outline'],
          };
          const [on, off] = mapa[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? on : off} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Inicio" component={HomeScreen} options={{ title: 'Início' }} />
      <Tabs.Screen name="RotasTab" component={RotasStack} options={{ title: 'Rotas' }} />
      <Tabs.Screen name="ProdutosTab" component={ProdutosStack} options={{ title: 'Produtos' }} />
      <Tabs.Screen name="MaisTab" component={MaisStack} options={{ title: 'Mais' }} />
    </Tabs.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
      <NavigationContainer theme={tema}>
        <Root.Navigator id="root" screenOptions={{ headerShown: false }}>
          <Root.Screen name="Login" component={LoginScreen} />
          <Root.Screen name="App" component={AppTabs} />
        </Root.Navigator>
      </NavigationContainer>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
