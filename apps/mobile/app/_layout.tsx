import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { inicializarBanco, migrarBanco } from '../src/db/schema';
import { registrarSyncBackground } from '../src/services/backgroundSync';
import { ProvedorTema, useTema } from '../src/theme';

function StackTematizado() {
  const { cores, escuro } = useTema();
  return (
    <>
      <StatusBar
        barStyle="light-content" // header é primária (escura) nos dois temas
        backgroundColor={escuro ? cores.cartao : cores.primaria}
      />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: escuro ? cores.cartao : cores.primaria },
          headerTintColor: escuro ? cores.texto : '#fff',
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
      <Stack.Screen name="index" options={{ title: 'Entrar', headerShown: false }} />
      <Stack.Screen name="(app)/rotas" options={{ title: 'Rotas', headerBackVisible: false }} />
      <Stack.Screen name="(app)/clientes" options={{ title: 'Clientes' }} />
      <Stack.Screen name="(app)/cliente-novo" options={{ title: 'Novo Cliente' }} />
      <Stack.Screen name="(app)/cliente/[id]" options={{ title: 'Cliente' }} />
      <Stack.Screen name="(app)/cobranca/[locacaoId]" options={{ title: 'Registrar Cobrança' }} />
      <Stack.Screen name="(app)/saldo/[id]" options={{ title: 'Saldo Devedor' }} />
      <Stack.Screen name="(app)/config/impressora" options={{ title: 'Ajustes' }} />
      <Stack.Screen name="(app)/deposito" options={{ title: 'Em Depósito' }} />
      <Stack.Screen name="(app)/historico/[locacaoId]" options={{ title: 'Histórico' }} />
      <Stack.Screen name="(app)/cliente-editar/[id]" options={{ title: 'Editar Cliente' }} />
      <Stack.Screen name="(app)/locacao-nova/[clienteId]" options={{ title: 'Nova Locação' }} />
      <Stack.Screen name="(app)/finalizar/[locacaoId]" options={{ title: 'Finalizar Locação' }} />
      <Stack.Screen name="(app)/sync-erros" options={{ title: 'Pendências de Sincronização' }} />
      <Stack.Screen name="(app)/locacao-editar/[locacaoId]" options={{ title: 'Editar Regras' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    inicializarBanco();
    migrarBanco();
    registrarSyncBackground();
  }, []);

  return (
    <ProvedorTema>
      <StackTematizado />
    </ProvedorTema>
  );
}
