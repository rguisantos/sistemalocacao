import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { login } from '../src/services/auth';
import { useApp } from '../src/store/app';
import { sincronizar } from '../src/services/sync';
import { criarEstilos, useCores } from '../src/theme';

export default function LoginScreen() {
  const s = useEstilos();
  const cores = useCores();
  const setUsuario = useApp((s) => s.setUsuario);
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro('');
    setCarregando(true);
    try {
      const usuario = await login(cpf.replace(/\D/g, ''), senha);
      setUsuario(usuario);
      sincronizar(); // dispara sync inicial sem bloquear navegação
      router.replace('/(app)/rotas');
    } catch (e: any) {
      setErro(e?.message ?? 'Falha no login');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.titulo}>Locações</Text>
      <Text style={s.subtitulo}>Cobranças em campo, online ou offline</Text>

      <TextInput
        style={s.input} placeholder="CPF (somente números)" placeholderTextColor={cores.textoFraco}
        keyboardType="number-pad" maxLength={11} value={cpf} onChangeText={setCpf}
      />
      <TextInput
        style={s.input} placeholder="Senha" placeholderTextColor={cores.textoFraco}
        secureTextEntry value={senha} onChangeText={setSenha}
      />
      {erro ? <Text style={s.erro}>{erro}</Text> : null}

      <Pressable style={s.botao} onPress={entrar} disabled={carregando}>
        {carregando ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTexto}>Entrar</Text>}
      </Pressable>
    </View>
  );
}

const useEstilos = criarEstilos((c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.primaria, justifyContent: 'center', padding: 24 },
  titulo: { fontSize: 32, fontWeight: '800', color: c.brancoFixo, textAlign: 'center' },
  subtitulo: { color: '#cde5d8', textAlign: 'center', marginBottom: 32 }, // sobre primária: fixo nos 2 temas
  input: {
    backgroundColor: c.cartao, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, fontSize: 16,
  },
  erro: { color: '#ffd2d2', marginBottom: 8, textAlign: 'center' }, // sobre primária: fixo nos 2 temas
  botao: {
    backgroundColor: c.primariaEscura, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  botaoTexto: { color: c.brancoFixo, fontWeight: '700', fontSize: 16 },
}));
