import { useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import {
  impressoraDisponivel, parearImpressora, conectarImpressora,
} from '../../../src/services/impressora';
import { criarEstilos, useTema, type ModoTema } from '../../../src/theme';

const MODOS: { valor: ModoTema; rotulo: string }[] = [
  { valor: 'auto', rotulo: 'Automático' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

export default function ImpressoraScreen() {
  const s = useEstilos();
  const { modo, setModo } = useTema();
  const [dispositivos, setDispositivos] = useState<{ nome: string; endereco: string }[]>([]);
  const [conectado, setConectado] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');

  const disponivel = impressoraDisponivel();

  async function buscar() {
    setErro('');
    setBuscando(true);
    try {
      const pareados = await parearImpressora();
      setDispositivos(
        pareados.map((p) => {
          const [nome, endereco] = p.split('|');
          return { nome: nome || 'Sem nome', endereco };
        })
      );
    } catch (e: any) {
      setErro(e?.message ?? 'Falha ao buscar dispositivos');
    } finally {
      setBuscando(false);
    }
  }

  async function conectar(endereco: string, nome: string) {
    setErro('');
    try {
      await conectarImpressora(endereco);
      setConectado(nome);
    } catch (e: any) {
      setErro(e?.message ?? 'Falha ao conectar');
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.titulo}>Aparência</Text>
      <View style={s.seletorTema}>
        {MODOS.map((m) => (
          <Pressable
            key={m.valor}
            onPress={() => setModo(m.valor)}
            style={[s.opcaoTema, modo === m.valor && s.opcaoTemaAtiva]}
          >
            <Text style={modo === m.valor ? s.opcaoTemaTextoAtivo : s.opcaoTemaTexto}>
              {m.rotulo}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.titulo}>Impressora térmica</Text>

      {!disponivel ? (
        <View style={s.aviso}>
          <Text style={s.avisoTitulo}>Módulo Bluetooth não incluído neste build</Text>
          <Text style={s.avisoTexto}>
            Os recibos serão gerados em PDF para compartilhar. Para imprimir direto na
            térmica, gere um build nativo:{'\n\n'}
            1. npx expo prebuild{'\n'}
            2. npm i react-native-bluetooth-escpos-printer{'\n'}
            3. eas build --platform android
          </Text>
        </View>
      ) : (
        <>
          {conectado && (
            <Text style={s.conectado}>✓ Conectado a {conectado}</Text>
          )}
          <Pressable style={s.botao} onPress={buscar} disabled={buscando}>
            {buscando
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.botaoTexto}>Buscar impressoras pareadas</Text>}
          </Pressable>
          {erro ? <Text style={s.erro}>{erro}</Text> : null}
          <FlatList
            data={dispositivos}
            keyExtractor={(d) => d.endereco}
            renderItem={({ item }) => (
              <Pressable style={s.dispositivo} onPress={() => conectar(item.endereco, item.nome)}>
                <Text style={s.dispositivoNome}>{item.nome}</Text>
                <Text style={s.dispositivoEnd}>{item.endereco}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={s.dica}>
                Pareie a impressora nas configurações de Bluetooth do aparelho antes de buscar.
              </Text>
            }
          />
        </>
      )}
    </View>
  );
}

const useEstilos = criarEstilos((c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.fundo, padding: 16 },
  titulo: { fontSize: 20, fontWeight: '800', color: c.primaria, marginBottom: 16 },
  seletorTema: {
    flexDirection: 'row', backgroundColor: c.cartao, borderRadius: 12,
    padding: 4, marginBottom: 24, gap: 4,
  },
  opcaoTema: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  opcaoTemaAtiva: { backgroundColor: c.primaria },
  opcaoTemaTexto: { color: c.textoSuave, fontWeight: '600', fontSize: 13 },
  opcaoTemaTextoAtivo: { color: c.brancoFixo, fontWeight: '700', fontSize: 13 },
  aviso: { backgroundColor: c.cartao, borderRadius: 12, padding: 16 },
  avisoTitulo: { fontWeight: '700', marginBottom: 8, color: c.aviso },
  avisoTexto: { color: c.textoSuave, fontSize: 13, lineHeight: 20 },
  conectado: { color: c.primaria, fontWeight: '700', marginBottom: 12 },
  botao: { backgroundColor: c.primaria, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  botaoTexto: { color: c.brancoFixo, fontWeight: '700' },
  erro: { color: c.erro, marginBottom: 8 },
  dispositivo: { backgroundColor: c.cartao, borderRadius: 10, padding: 14, marginBottom: 8 },
  dispositivoNome: { fontWeight: '700' },
  dispositivoEnd: { color: c.textoFraco, fontSize: 12 },
  dica: { color: c.textoFraco, textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
}));
