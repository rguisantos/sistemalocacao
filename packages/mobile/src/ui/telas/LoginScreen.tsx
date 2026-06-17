import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { login } from '../../auth/auth-service';
import { cores, espaco, raio, fonte } from '../tema';
import { CampoTexto, BotaoPrimario } from '../componentes/kit';

export function LoginScreen({ navigation }: any) {
  const [cpf, setCpf] = useState(''); const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false); const [erro, setErro] = useState('');

  async function entrar() {
    setErro(''); setCarregando(true);
    try { await login(cpf.replace(/\D/g, ''), senha); navigation.replace('App'); }
    catch (e: any) { setErro(e.message ?? 'Falha no login.'); }
    finally { setCarregando(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.primaria, justifyContent: 'center', padding: espaco.xl }}>
      <View style={{ alignItems: 'center', marginBottom: espaco.xxl, gap: espaco.md }}>
        <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: cores.acento, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="cash" size={36} color="#fff" />
        </View>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>Locações e Cobranças</Text>
        <Text style={{ color: '#ffffffaa' }}>Acesso do cobrador</Text>
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: raio.lg, padding: espaco.lg, gap: espaco.md }}>
        <CampoTexto label="CPF" keyboardType="number-pad" value={cpf} onChangeText={setCpf} placeholder="000.000.000-00" />
        <CampoTexto label="Senha" secureTextEntry value={senha} onChangeText={setSenha} placeholder="••••••••" />
        {erro ? <Text style={{ color: cores.perigo }}>{erro}</Text> : null}
        {carregando ? <ActivityIndicator color={cores.primaria} style={{ paddingVertical: 8 }} /> : <BotaoPrimario titulo="Entrar" icone="log-in" onPress={entrar} />}
      </View>
    </View>
  );
}
