import { useCallback, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { db } from '../../src/db/schema';
import { useApp } from '../../src/store/app';
import { sincronizar, contarPendentes, contarErros } from '../../src/services/sync';
import { mapaVencidasPorCliente } from '../../src/services/vencidasLocal';
import { PERMISSOES } from '@locacoes/shared';

interface ClienteRow {
  id: string;
  nome: string;
  rota_nome: string;
  locacoes_ativas: number;
  saldo_total: string;
}

export default function ClientesScreen() {
  const { rotaId, rotaNome } = useLocalSearchParams<{ rotaId?: string; rotaNome?: string }>();
  const { usuario, pendentes, setPendentes, temPermissao } = useApp();
  const [busca, setBusca] = useState('');
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [statusSync, setStatusSync] = useState('');
  const [vencidas, setVencidas] = useState<Record<string, number>>({});
  const [soVencidas, setSoVencidas] = useState(false);
  const [errosSync, setErrosSync] = useState(0);

  const carregar = useCallback(() => {
    const rows = db.getAllSync<ClienteRow>(
      `SELECT c.id, c.nome, r.nome AS rota_nome,
        (SELECT COUNT(*) FROM locacoes l WHERE l.cliente_id = c.id AND l.status = 'ATIVA' AND l.is_deleted = 0) AS locacoes_ativas,
        COALESCE((SELECT SUM(CAST(l.saldo_atual AS REAL)) FROM locacoes l WHERE l.cliente_id = c.id AND l.status = 'ATIVA'), 0) AS saldo_total
       FROM clientes c
       JOIN rotas r ON r.id = c.rota_id
       WHERE c.is_deleted = 0 AND c.nome LIKE ?
         ${rotaId ? 'AND c.rota_id = ?' : ''}
       ORDER BY c.nome`,
      rotaId ? [`%${busca}%`, rotaId] : [`%${busca}%`]
    );
    setClientes(rows);
    setVencidas(mapaVencidasPorCliente());
    setPendentes(contarPendentes());
    setErrosSync(contarErros());
  }, [busca, rotaId]);

  useFocusEffect(carregar);

  async function sync() {
    setStatusSync('Sincronizando…');
    const r = await sincronizar();
    setStatusSync(r.ok ? `✓ ${r.enviados ?? 0} enviados, ${r.recebidos ?? 0} recebidos` : r.mensagem);
    carregar();
  }

  return (
    <View style={s.container}>
      <View style={s.topo}>
        <TextInput
          style={s.busca} placeholder="Buscar cliente…" value={busca}
          onChangeText={(t) => { setBusca(t); }} onEndEditing={carregar}
        />
        <Pressable style={s.btnNovo} onPress={() => router.push('/(app)/cliente-novo')}>
          <Text style={s.btnSyncTexto}>＋</Text>
        </Pressable>
        <Pressable style={s.btnSync} onPress={sync}>
          <Text style={s.btnSyncTexto}>⟳{pendentes > 0 ? ` ${pendentes}` : ''}</Text>
        </Pressable>
      </View>
      {rotaNome ? <Text style={s.tituloRota}>Rota {rotaNome}</Text> : null}
      {statusSync ? <Text style={s.status}>{statusSync}</Text> : null}

      {errosSync > 0 && (
        <Pressable style={s.faixaErro} onPress={() => router.push('/(app)/sync-erros')}>
          <Text style={s.faixaErroTexto}>
            ⚠ {errosSync} registro(s) rejeitado(s) pelo servidor — tocar para revisar
          </Text>
        </Pressable>
      )}

      <Pressable style={s.filtroVencidas} onPress={() => setSoVencidas(!soVencidas)}>
        <Text style={[s.filtroTexto, soVencidas && s.filtroTextoAtivo]}>
          {soVencidas ? '● ' : '○ '}Somente vencidas ({Object.keys(vencidas).length})
        </Text>
      </Pressable>

      <FlatList
        data={soVencidas ? clientes.filter((c) => vencidas[c.id]) : clientes}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable
            style={[s.card, vencidas[item.id] ? s.cardVencida : null]}
            onPress={() => router.push(`/(app)/cliente/${item.id}`)}
          >
            <View style={s.nomeLinha}>
              <Text style={s.nome}>{item.nome}</Text>
              {vencidas[item.id] ? (
                <Text style={s.badgeVencida}>{vencidas[item.id]}d atraso</Text>
              ) : null}
            </View>
            <Text style={s.detalhe}>
              {item.rota_nome} · {item.locacoes_ativas} locação(ões)
              {Number(item.saldo_total) > 0 ? ` · deve R$ ${Number(item.saldo_total).toFixed(2)}` : ''}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={s.vazio}>Nenhum cliente local. Toque em ⟳ para sincronizar.</Text>
        }
      />
      <View style={s.rodapeLinha}>
        <Text style={s.rodape}>Logado como {usuario?.nome}</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {temPermissao(PERMISSOES.VISUALIZAR_PRODUTOS_DEPOSITO) && (
            <Pressable onPress={() => router.push('/(app)/deposito')}>
              <Text style={s.rodapeLink}>Depósito</Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.push('/(app)/config/impressora')}>
            <Text style={s.rodapeLink}>Impressora ⚙</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ea' },
  topo: { flexDirection: 'row', padding: 12, gap: 8 },
  busca: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  btnSync: { backgroundColor: '#1b5e3f', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  btnNovo: { backgroundColor: '#0e3a24', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  btnSyncTexto: { color: '#fff', fontWeight: '700' },
  status: { textAlign: 'center', color: '#666', marginBottom: 4, fontSize: 12 },
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 14 },
  nomeLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nome: { fontWeight: '700', fontSize: 16, color: '#222' },
  cardVencida: { borderLeftWidth: 4, borderLeftColor: '#e0a000' },
  badgeVencida: { backgroundColor: '#fff3cd', color: '#8a6d00', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  filtroVencidas: { paddingHorizontal: 14, paddingBottom: 6 },
  filtroTexto: { color: '#888', fontSize: 13 },
  filtroTextoAtivo: { color: '#8a6d00', fontWeight: '700' },
  faixaErro: { backgroundColor: '#fdecea', marginHorizontal: 12, marginBottom: 8, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#f5c6c0' },
  faixaErroTexto: { color: '#8a1c12', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  tituloRota: { paddingHorizontal: 14, color: '#1b5e3f', fontWeight: '800', fontSize: 16, marginBottom: 4 },
  detalhe: { color: '#666', marginTop: 2, fontSize: 13 },
  vazio: { textAlign: 'center', color: '#888', marginTop: 40, paddingHorizontal: 24 },
  rodape: { color: '#999', fontSize: 11 },
  rodapeLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 6 },
  rodapeLink: { color: '#1b5e3f', fontSize: 11, fontWeight: '700' },
});
