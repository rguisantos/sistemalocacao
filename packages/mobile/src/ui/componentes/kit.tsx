import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, StyleProp, TextInput, TextInputProps, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cores, tint, espaco, raio, sombra, fonte } from '../tema';

type Icone = keyof typeof Ionicons.glyphMap;

/** Ícone dentro de um chip colorido (padrão do app de referência). */
export function IconeChip({ nome, cor = cores.primaria, tamanho = 40 }: { nome: Icone; cor?: string; tamanho?: number }) {
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho * 0.28, backgroundColor: cor, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={nome} size={tamanho * 0.5} color="#fff" />
    </View>
  );
}

/** Cartão branco elevado. */
export function Cartao({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const conteudo = (
    <View style={[{ backgroundColor: cores.superficie, borderRadius: raio.lg, padding: espaco.lg, borderWidth: 1, borderColor: cores.borda }, sombra, style]}>
      {children}
    </View>
  );
  return onPress ? <TouchableOpacity activeOpacity={0.7} onPress={onPress}>{conteudo}</TouchableOpacity> : conteudo;
}

type Status = 'sucesso' | 'aviso' | 'perigo' | 'info' | 'neutro';
const mapaStatus: Record<Status, { cor: string; bg: string; icone: Icone }> = {
  sucesso: { cor: cores.sucesso, bg: cores.sucessoSuave, icone: 'checkmark-circle' },
  aviso: { cor: cores.aviso, bg: cores.avisoSuave, icone: 'alert-circle' },
  perigo: { cor: cores.perigo, bg: cores.perigoSuave, icone: 'close-circle' },
  info: { cor: cores.info, bg: cores.infoSuave, icone: 'information-circle' },
  neutro: { cor: cores.suave, bg: '#F1F5F9', icone: 'ellipse' },
};

/** Pílula de status (variante "soft"). */
export function StatusBadge({ status, texto }: { status: Status; texto: string }) {
  const c = mapaStatus[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.bg, borderRadius: raio.pill, paddingVertical: 3, paddingHorizontal: 9, alignSelf: 'flex-start' }}>
      <Ionicons name={c.icone} size={13} color={c.cor} />
      <Text style={{ color: c.cor, fontSize: 12, fontWeight: '600' }}>{texto}</Text>
    </View>
  );
}

/** Card de métrica para o dashboard (grade 2-col). */
export function MetricCard({ titulo, valor, icone, cor = cores.info, onPress }: { titulo: string; valor: string | number; icone: Icone; cor?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress}
      style={[{ width: '48%', backgroundColor: tint(cor), borderRadius: raio.lg, padding: espaco.lg, marginBottom: espaco.md, borderWidth: 1, borderColor: cores.borda }]}>
      <IconeChip nome={icone} cor={cor} />
      <Text style={[fonte.valor, { color: cor, marginTop: espaco.md }]}>{valor}</Text>
      <Text style={{ ...fonte.rotulo, marginTop: 2 }} numberOfLines={2}>{titulo}</Text>
    </TouchableOpacity>
  );
}

/** Botão de ação rápida (ícone grande + rótulo). */
export function QuickAction({ titulo, icone, cor = cores.primaria, onPress }: { titulo: string; icone: Icone; cor?: string; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}
      style={{ flex: 1, backgroundColor: cores.superficie, borderRadius: raio.lg, padding: espaco.md, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: cores.borda }}>
      <IconeChip nome={icone} cor={cor} tamanho={48} />
      <Text style={{ fontSize: 12, color: cores.texto, fontWeight: '600', textAlign: 'center' }} numberOfLines={2}>{titulo}</Text>
    </TouchableOpacity>
  );
}

/** Estado vazio amigável. */
export function EmptyState({ icone = 'file-tray-outline', titulo, descricao }: { icone?: Icone; titulo: string; descricao?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: espaco.xxl, gap: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: cores.primariaSuave, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icone} size={30} color={cores.primaria} />
      </View>
      <Text style={{ ...fonte.secao, marginTop: 4 }}>{titulo}</Text>
      {descricao ? <Text style={{ color: cores.suave, textAlign: 'center' }}>{descricao}</Text> : null}
    </View>
  );
}

/** Cabeçalho de seção. */
export function CabecalhoSecao({ titulo, acao }: { titulo: string; acao?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: espaco.sm }}>
      <Text style={fonte.secao}>{titulo}</Text>
      {acao}
    </View>
  );
}

/** Botão primário sólido. Quando `carregando`, ignora toques e mostra spinner. */
export function BotaoPrimario({ titulo, onPress, cor = cores.primaria, icone, carregando = false }: { titulo: string; onPress: () => void; cor?: string; icone?: Icone; carregando?: boolean }) {
  return (
    <TouchableOpacity activeOpacity={0.85} disabled={carregando} onPress={onPress}
      style={{ flexDirection: 'row', gap: 8, backgroundColor: cor, opacity: carregando ? 0.6 : 1, borderRadius: raio.md, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
      {carregando ? <ActivityIndicator color="#fff" /> : (
        <>
          {icone ? <Ionicons name={icone} size={18} color="#fff" /> : null}
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{titulo}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}


/** Campo de texto rotulado, no estilo do tema. */
export function CampoTexto({ label, style, ...props }: { label?: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={fonte.rotulo}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={cores.leve}
        {...props}
        style={[{ backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda, borderRadius: raio.md, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: cores.texto }, style]}
      />
    </View>
  );
}

/** Seção de formulário (título + conteúdo em cartão). */
export function Secao({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: espaco.md }}>
      {titulo ? <Text style={fonte.secao}>{titulo}</Text> : null}
      <Cartao style={{ gap: espaco.md }}>{children}</Cartao>
    </View>
  );
}
