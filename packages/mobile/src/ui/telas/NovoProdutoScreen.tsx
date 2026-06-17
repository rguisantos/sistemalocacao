import React, { useEffect, useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import { criarProduto, listarTipos, listarTamanhos, listarCondicoes } from '../../dominio/repositorios';
import { Selecao } from '../componentes/Selecao';
import { cores, espaco } from '../tema';
import { CampoTexto, Secao, BotaoPrimario } from '../componentes/kit';

export function NovoProdutoScreen({ navigation }: any) {
  const [tipos, setTipos] = useState<any[]>([]); const [tamanhos, setTamanhos] = useState<any[]>([]); const [condicoes, setCondicoes] = useState<any[]>([]);
  const [p, setP] = useState<any>({ contador: '0' });
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { listarTipos().then(setTipos); listarTamanhos().then(setTamanhos); listarCondicoes().then(setCondicoes); }, []);

  async function salvar() {
    if (!p.plaqueta || !p.tipoId || !p.tamanhoId || !p.condicaoId) return Alert.alert('Atenção', 'Plaqueta, tipo, tamanho e condição são obrigatórios.');
    if (enviando) return;
    setEnviando(true);
    try {
      await criarProduto({ plaqueta: p.plaqueta, tipoId: p.tipoId, descricao: p.descricao, tamanhoId: p.tamanhoId, condicaoId: p.condicaoId, chave: p.chave, contador: Number(p.contador || 0) });
      Alert.alert('Pronto', 'Produto salvo.'); navigation.goBack();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setEnviando(false); }
  }

  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <Secao titulo="Produto">
        <CampoTexto label="Plaqueta" value={p.plaqueta ?? ''} onChangeText={(v) => setP({ ...p, plaqueta: v })} />
        <CampoTexto label="Descrição (cor)" value={p.descricao ?? ''} onChangeText={(v) => setP({ ...p, descricao: v })} />
        <Selecao rotulo="Tipo" valor={p.tipoId} opcoes={tipos.map((t) => ({ id: t.id, rotulo: t.nome }))} aoSelecionar={(id) => setP({ ...p, tipoId: id })} />
        <Selecao rotulo="Tamanho" valor={p.tamanhoId} opcoes={tamanhos.map((t) => ({ id: t.id, rotulo: t.descricao }))} aoSelecionar={(id) => setP({ ...p, tamanhoId: id })} />
        <Selecao rotulo="Condição" valor={p.condicaoId} opcoes={condicoes.map((c) => ({ id: c.id, rotulo: c.descricao }))} aoSelecionar={(id) => setP({ ...p, condicaoId: id })} />
        <CampoTexto label="Chave (opcional)" value={p.chave ?? ''} onChangeText={(v) => setP({ ...p, chave: v })} />
        <CampoTexto label="Contador inicial" keyboardType="number-pad" value={String(p.contador ?? '')} onChangeText={(v) => setP({ ...p, contador: v })} />
      </Secao>
      <BotaoPrimario titulo="Salvar produto" icone="checkmark" onPress={salvar} carregando={enviando} />
    </ScrollView>
  );
}
