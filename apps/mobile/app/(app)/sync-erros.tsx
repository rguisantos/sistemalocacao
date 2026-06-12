// apps/mobile/app/(app)/sync-erros.tsx
// Revisão de registros REJEITADOS pelo servidor no push.
// Ações por item:
//  - Tentar novamente: volta o registro para a fila (PENDING_*)
//  - Descartar: abandona a alteração local; o próximo pull restaura
//    o estado oficial do servidor (cobranças descartadas são removidas
//    e o saldo da locação volta pelo pull).
import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { db } from '../../src/db/schema';
import { sincronizar, estaOnline } from '../../src/services/sync';
import { api } from '../../src/services/api';

interface ErroRow {
  registro_id: string;
  tabela: string;
  op_original: string;
  mensagem: string | null;
  created_at: string;
  descricao: string; // montada por tabela
}

const NOME_TABELA: Record<string, string> = {
  clientes: 'Cliente', enderecos: 'Endereço', locacoes: 'Locação', cobrancas: 'Cobrança',
};

function descreverRegistro(tabela: string, id: string): string {
  try {
    if (tabela === 'clientes') {
      const r = db.getFirstSync<any>(`SELECT nome FROM clientes WHERE id = ?`, [id]);
      return r?.nome ?? id.slice(0, 8);
    }
    if (tabela === 'enderecos') {
      const r = db.getFirstSync<any>(
        `SELECT e.logradouro, e.numero, c.nome FROM enderecos e
         LEFT JOIN clientes c ON c.id = e.cliente_id WHERE e.id = ?`, [id]);
      return r ? `${r.logradouro}, ${r.numero} (${r.nome ?? '?'})` : id.slice(0, 8);
    }
    if (tabela === 'locacoes') {
      const r = db.getFirstSync<any>(
        `SELECT p.plaqueta, c.nome FROM locacoes l
         LEFT JOIN produtos p ON p.id = l.produto_id
         LEFT JOIN clientes c ON c.id = l.cliente_id WHERE l.id = ?`, [id]);
      return r ? `${r.plaqueta ?? '?'} · ${r.nome ?? '?'}` : id.slice(0, 8);
    }
    if (tabela === 'cobrancas') {
      const r = db.getFirstSync<any>(
        `SELECT cb.valor_recebido_pago, c.nome FROM cobrancas cb
         LEFT JOIN locacoes l ON l.id = cb.locacao_id
         LEFT JOIN clientes c ON c.id = l.cliente_id WHERE cb.id = ?`, [id]);
      return r ? `R$ ${r.valor_recebido_pago} · ${r.nome ?? '?'}` : id.slice(0, 8);
    }
  } catch { /* descrição é cosmética */ }
  return id.slice(0, 8);
}

interface ConflitoMeu {
  id: string; entidade: string; entidadeId: string;
  camposConflitantes: string[]; createdAt: string;
}

const NOME_ENTIDADE: Record<string, string> = {
  clientes: 'Cliente', enderecos: 'Endereço', locacoes: 'Locação', cobrancas: 'Cobrança',
};

export default function SyncErrosScreen() {
  const [erros, setErros] = useState<ErroRow[]>([]);
  const [conflitos, setConflitos] = useState<ConflitoMeu[]>([]);

  const carregar = useCallback(() => {
    const rows = db.getAllSync<Omit<ErroRow, 'descricao'>>(
      `SELECT * FROM sync_erros ORDER BY created_at DESC`
    );
    setErros(rows.map((r) => ({ ...r, descricao: descreverRegistro(r.tabela, r.registro_id) })));
  }, []);

  useFocusEffect(carregar);

  // Conflitos do próprio usuário aguardando revisão no painel (online).
  // Read-only: a decisão (manter servidor / aplicar aparelho / mesclar)
  // é do escritório — aqui o cobrador só fica sabendo.
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        if (!(await estaOnline())) return;
        try {
          const r = await api<ConflitoMeu[]>('/api/conflitos/meus');
          if (ativo) setConflitos(r);
        } catch { /* melhor-esforço */ }
      })();
      return () => { ativo = false; };
    }, [])
  );

  function tentarNovamente(e: ErroRow) {
    db.withTransactionSync(() => {
      db.runSync(`UPDATE ${e.tabela} SET sync_status = ? WHERE id = ?`, [e.op_original, e.registro_id]);
      db.runSync(`DELETE FROM sync_erros WHERE registro_id = ?`, [e.registro_id]);
    });
    carregar();
    sincronizar().then(carregar);
  }

  function descartar(e: ErroRow) {
    Alert.alert(
      'Descartar alteração?',
      e.tabela === 'cobrancas'
        ? 'A cobrança será removida deste aparelho. O saldo da locação volta ao valor do servidor na próxima sincronização.'
        : 'A alteração local será abandonada. O registro volta ao estado do servidor na próxima sincronização.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            db.withTransactionSync(() => {
              if (e.tabela === 'cobrancas' || e.op_original === 'PENDING_CREATE') {
                // criação rejeitada: o registro não existe no servidor — remove local
                db.runSync(`DELETE FROM ${e.tabela} WHERE id = ?`, [e.registro_id]);
              } else {
                // edição rejeitada: marca SYNCED; pull restaura os dados oficiais
                db.runSync(`UPDATE ${e.tabela} SET sync_status = 'SYNCED' WHERE id = ?`, [e.registro_id]);
              }
              db.runSync(`DELETE FROM sync_erros WHERE registro_id = ?`, [e.registro_id]);
            });
            carregar();
            sincronizar().then(carregar);
          },
        },
      ]
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        data={erros}
        keyExtractor={(e) => e.registro_id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.linha}>
              <Text style={s.tipo}>{NOME_TABELA[item.tabela] ?? item.tabela}</Text>
              <Text style={s.data}>{new Date(item.created_at + 'Z').toLocaleString('pt-BR')}</Text>
            </View>
            <Text style={s.descricao}>{item.descricao}</Text>
            <Text style={s.mensagem}>Motivo: {item.mensagem ?? 'não informado'}</Text>
            <View style={s.acoes}>
              <Pressable style={s.btnRetry} onPress={() => tentarNovamente(item)}>
                <Text style={s.btnRetryTexto}>Tentar novamente</Text>
              </Pressable>
              <Pressable style={s.btnDescartar} onPress={() => descartar(item)}>
                <Text style={s.btnDescartarTexto}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          conflitos.length === 0 ? (
            <View style={s.vazioBox}>
              <Text style={s.vazioTitulo}>Nenhuma pendência ✓</Text>
              <Text style={s.vazio}>Todos os registros foram aceitos pelo servidor.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          conflitos.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Text style={s.tituloConflitos}>Em revisão no escritório</Text>
              <Text style={s.subtituloConflitos}>
                Estas alterações divergiram do painel e aguardam decisão manual.
                Enquanto isso, o aparelho usa a versão do servidor.
              </Text>
              {conflitos.map((c) => (
                <View key={c.id} style={s.cardConflito}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={s.conflitoTipo}>{NOME_ENTIDADE[c.entidade] ?? c.entidade}</Text>
                    <Text style={s.conflitoData}>
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                  <Text style={s.conflitoCampos}>
                    Campos: {(c.camposConflitantes ?? []).join(', ') || '—'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ea' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#b3261e' },
  linha: { flexDirection: 'row', justifyContent: 'space-between' },
  tipo: { fontWeight: '700', color: '#b3261e', fontSize: 13 },
  data: { color: '#999', fontSize: 11 },
  descricao: { fontWeight: '600', fontSize: 15, marginTop: 4 },
  mensagem: { color: '#666', fontSize: 13, marginTop: 4 },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnRetry: { backgroundColor: '#1b5e3f', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnRetryTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnDescartar: { borderWidth: 1, borderColor: '#b3261e', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnDescartarTexto: { color: '#b3261e', fontWeight: '600', fontSize: 13 },
  vazioBox: { alignItems: 'center', marginTop: 60 },
  vazioTitulo: { fontWeight: '800', color: '#1b5e3f', fontSize: 16 },
  vazio: { color: '#888', marginTop: 4 },
  tituloConflitos: { fontWeight: '800', color: '#8a6d00', fontSize: 15 },
  subtituloConflitos: { color: '#8a6d00', fontSize: 12, marginTop: 2, marginBottom: 8 },
  cardConflito: { backgroundColor: '#fff8e6', borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#d4a017' },
  conflitoTipo: { fontWeight: '700', color: '#8a6d00', fontSize: 13 },
  conflitoData: { color: '#999', fontSize: 11 },
  conflitoCampos: { color: '#666', fontSize: 13, marginTop: 4 },
});
