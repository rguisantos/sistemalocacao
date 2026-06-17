import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cores, espaco, raio, fonte } from '../tema';

/**
 * Captura erros de render/lifecycle das telas e mostra uma tela amigável em vez de
 * derrubar o app (o React Native não tem rede de proteção por padrão). Os dados locais
 * (SQLite) não são afetados. "Tentar novamente" limpa o erro e re-renderiza.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { erro: Error | null }> {
  state: { erro: Error | null } = { erro: null };

  static getDerivedStateFromError(erro: Error) { return { erro }; }

  componentDidCatch(erro: Error, info: React.ErrorInfo) {
    // log local (visível no Metro/console); não envia nada para fora.
    console.error('[ErrorBoundary]', erro?.message, info?.componentStack);
  }

  reiniciar = () => this.setState({ erro: null });

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo, alignItems: 'center', justifyContent: 'center', padding: espaco.xl, gap: espaco.lg }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: cores.perigoSuave, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="warning" size={34} color={cores.perigo} />
        </View>
        <Text style={fonte.titulo}>Algo deu errado</Text>
        <Text style={{ color: cores.suave, textAlign: 'center' }}>
          O app encontrou um erro inesperado nesta tela. Seus dados locais estão salvos.
        </Text>
        <TouchableOpacity onPress={this.reiniciar} activeOpacity={0.85}
          style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: cores.primaria, borderRadius: raio.md, paddingVertical: 14, paddingHorizontal: 24 }}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700' }}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
