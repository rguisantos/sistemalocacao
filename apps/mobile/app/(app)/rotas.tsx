// Tela inicial do cobrador: rotas atribuídas, com contagem de clientes
// e de cobranças vencidas por rota — 100% local (offline).
// Com uma única rota, pula direto para a lista de clientes.
import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { db } from '../../src/db/schema';
import { useApp } from '../../src/store/app';
import { sincronizar, contarPendentes } from '../../src/services/sync';
import { listarVencidasLocal } from '../../src/services/vencidasLocal';
import { criarEstilos } from '../../src/theme';

interface RotaCard {
  id: string;
  nome: string;
  clientes: number;
  vencidas: number;
}

export default function RotasScreen() {
  const s = useEstilos();
  const { usuario, pendentes, setPendentes } = useApp();
  const [rotas, setRotas] = useState<RotaCard[]>([]);
  const [statusSync, setStatusSync] = useState('');

  const carregar = useCallback(() => {
    const base = db.getAllSync<{ id: string; nome: string; clientes: number }>(
      `SELECT r.id, r.nome,
        (SELECT COUNT(*) FROM clientes c WHERE c.rota_id = r.id AND c.is_deleted = 0) AS clientes
       FROM rotas r WHERE r.is_deleted = 0 AND r.ativo = 1 ORDER BY r.nome`
    );
    // vencidas por rota (cliente → rota)
    const vencidas = listarVencidasLocal();
    const rotaPorCliente = new Map(
      db.getAllSync<{ id: string; rota_id: string }>(
        `SELECT id, rota_id FROM clientes WHERE is_deleted = 0`
      ).map((c) => [c.id, c.rota_id])
    );
    const contagem: Record<string, number> = {};
    for (const v of vencidas) {
      const rotaId = rotaPorCliente.get(v.clienteId);
      if (rotaId) contagem[rotaId] = (contagem[rotaId] ?? 0) + 1;
    }
    const cards = base.map((r) => ({ ...r, vencidas: contagem[r.id] ?? 0 }));
    setRotas(cards);
    setPendentes(contarPendentes());

    // Uma rota só: vai direto para os clientes dela
    if (cards.length === 1) {
      router.replace({ pathname: '/(app)/clientes', params: { rotaId: cards[0].id, rotaNome: cards[0].nome } });
    }
  }, []);

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
        <Text style={s.saudacao}>Olá, {usuario?.nome?.split(' ')[0]}</Text>
        <Pressable style={s.btnSync} onPress={sync}>
          <Text style={s.btnSyncTexto}>⟳{pendentes > 0 ? ` ${pendentes}` : ''}</Text>
        </Pressable>
      </View>
      {statusSync ? <Text style={s.status}>{statusSync}</Text> : null}
      <Text style={s.titulo}>Suas rotas</Text>

      <FlatList
        data={rotas}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <Pressable
            style={s.card}
            onPress={() =>
              router.push({ pathname: '/(app)/clientes', params: { rotaId: item.id, rotaNome: item.nome } })
            }
          >
            <View style={s.linha}>
              <Text style={s.nome}>{item.nome}</Text>
              {item.vencidas > 0 && (
                <Text style={s.badgeVencida}>{item.vencidas} vencida(s)</Text>
              )}
            </View>
            <Text style={s.detalhe}>{item.clientes} cliente(s)</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={s.vazio}>Nenhuma rota atribuída. Toque em ⟳ para sincronizar.</Text>
        }
      />
    </View>
  );
}

const useEstilos = criarEstilos((c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.fundo },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 4 },
  saudacao: { fontSize: 16, color: c.textoSuave },
  btnSync: { backgroundColor: c.primaria, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnSyncTexto: { color: c.brancoFixo, fontWeight: '700' },
  status: { textAlign: 'center', color: c.textoSuave, fontSize: 12 },
  titulo: { fontSize: 22, fontWeight: '800', color: c.primaria, paddingHorizontal: 14, marginTop: 6 },
  card: { backgroundColor: c.cartao, borderRadius: 12, padding: 16, marginBottom: 10 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nome: { fontWeight: '800', fontSize: 18, color: c.texto },
  badgeVencida: { backgroundColor: c.avisoSuave, color: c.aviso, fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  detalhe: { color: c.textoFraco, marginTop: 4 },
  vazio: { textAlign: 'center', color: c.textoFraco, marginTop: 40, paddingHorizontal: 24 },
}));
