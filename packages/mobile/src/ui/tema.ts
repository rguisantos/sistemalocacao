import { Platform } from 'react-native';

/**
 * Tokens de design do app (centralizados — trocar a paleta aqui reflete em tudo).
 * Polimento inspirado no app de referência (neutros slate, superfícies suaves),
 * mantendo a identidade do domínio: verde "feltro" + acento latão.
 */
export const cores = {
  primaria: '#11392B', primariaClara: '#1C5340', primariaSuave: '#E7EFE9',
  acento: '#C08A2D', acentoClaro: '#D8A949', acentoSuave: '#F6ECD7',

  fundo: '#F4F6F5', superficie: '#FFFFFF',
  texto: '#1E293B', suave: '#64748B', leve: '#94A3B8',
  borda: '#E6EAE8',

  sucesso: '#16A34A', sucessoSuave: '#F0FDF4',
  aviso: '#EA580C', avisoSuave: '#FFF7ED',
  perigo: '#DC2626', perigoSuave: '#FEF2F2',
  info: '#2563EB', infoSuave: '#EFF4FF',
};

/** Cor com transparência em hex (ex.: tint(cores.info) → '#2563EB1A' = 10%). */
export const tint = (hex: string, alpha = '1A') => `${hex}${alpha}`;

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const raio = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const sombra = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 2 },
  default: {},
}) as object;

export const fonte = {
  titulo: { fontSize: 22, fontWeight: '700' as const, color: cores.texto, letterSpacing: -0.3 },
  secao: { fontSize: 16, fontWeight: '700' as const, color: cores.texto },
  corpo: { fontSize: 15, color: cores.texto },
  rotulo: { fontSize: 13, color: cores.suave, fontWeight: '500' as const },
  valor: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.5 },
};
