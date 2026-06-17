import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { obterCliente, atualizarCliente, listarRotas } from '../../dominio/repositorios';
import { Selecao } from '../componentes/Selecao';
import { GerenciadorEnderecosMobile } from '../componentes/GerenciadorEnderecosMobile';
import { cores, espaco, raio } from '../tema';
import { CampoTexto, Secao, BotaoPrimario } from '../componentes/kit';

export function EditarClienteScreen({ route, navigation }: any) {
  const clienteId: string = route.params.clienteId;
  const [c, setC] = useState<any>(null);
  const [rotas, setRotas] = useState<any[]>([]);

  useEffect(() => {
    listarRotas().then(setRotas);
    obterCliente(clienteId).then((r: any) => {
      let telefones: string[] = [];
      try { telefones = JSON.parse(r.telefones ?? '[]'); } catch { telefones = []; }
      setC({ ...r, telefone: telefones[0] ?? '' });
    });
  }, [clienteId]);

  async function salvar() {
    if (!c.nome) return Alert.alert('Atenção', 'Informe o nome.');
    try {
      await atualizarCliente(clienteId, { tipo: c.tipo, nome: c.nome, rgIe: c.rgIe, observacoes: c.observacoes, rotaId: c.rotaId, telefones: c.telefone ? [c.telefone] : [] });
      Alert.alert('Pronto', 'Cliente atualizado.'); navigation.goBack();
    } catch (e: any) { Alert.alert('Erro', e.message); }
  }

  if (!c) return <Text style={{ padding: espaco.lg }}>Carregando…</Text>;
  return (
    <ScrollView style={{ backgroundColor: cores.fundo }} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg }}>
      <Secao titulo="Dados">
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          {(['PF', 'PJ'] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setC({ ...c, tipo: t })} style={{ flex: 1, paddingVertical: 12, borderRadius: raio.md, alignItems: 'center', backgroundColor: c.tipo === t ? cores.primaria : cores.primariaSuave }}>
              <Text style={{ color: c.tipo === t ? '#fff' : cores.primaria, fontWeight: '600' }}>{t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <CampoTexto label="Nome / Razão social" value={c.nome ?? ''} onChangeText={(v) => setC({ ...c, nome: v })} />
        <Text style={{ color: cores.suave, fontSize: 12 }}>CPF/CNPJ: {c.cpfCnpj} (não editável)</Text>
        <CampoTexto label="Telefone" keyboardType="phone-pad" value={c.telefone ?? ''} onChangeText={(v) => setC({ ...c, telefone: v })} />
        <CampoTexto label="Observações" value={c.observacoes ?? ''} onChangeText={(v) => setC({ ...c, observacoes: v })} />
        <Selecao rotulo="Rota" valor={c.rotaId} opcoes={rotas.map((r) => ({ id: r.id, rotulo: r.nome }))} aoSelecionar={(id) => setC({ ...c, rotaId: id })} />
      </Secao>
      <BotaoPrimario titulo="Salvar cliente" icone="checkmark" onPress={salvar} />

      <Secao titulo="Endereços">
        <GerenciadorEnderecosMobile clienteId={clienteId} />
      </Secao>
    </ScrollView>
  );
}
