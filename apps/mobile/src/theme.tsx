// Sistema de tema do app (modo claro/escuro) — espelha os tokens do painel.
// - Modo 'auto' segue o sistema (useColorScheme); preferência persiste na
//   tabela meta do SQLite.
// - criarEstilos(fabrica) devolve um hook que materializa o StyleSheet uma
//   única vez por tema (cache de módulo) — custo zero nos re-renders.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getMeta, setMeta } from './db/schema';

export interface Cores {
  fundo: string;          // fundo das telas
  cartao: string;         // superfícies/cards
  texto: string;
  textoSuave: string;
  textoFraco: string;
  brancoFixo: string;     // texto sobre primária (branco nos dois temas)
  primaria: string;       // feltro
  primariaEscura: string;
  primariaSuave: string;  // fundos de destaque verdes
  primariaBorda: string;
  primariaTransl: string;
  erro: string;
  erroSuave: string;      // fundo de avisos de erro
  erroBorda: string;
  aviso: string;          // texto âmbar
  avisoSuave: string;
  avisoBorda: string;
  avisoForte: string;
}

// Claro: exatamente a paleta que o app sempre usou.
export const CORES_CLARO: Cores = {
  fundo: '#f5f2ea',
  cartao: '#fff',
  texto: '#222',
  textoSuave: '#555',
  textoFraco: '#888',
  brancoFixo: '#fff',
  primaria: '#1b5e3f',
  primariaEscura: '#0e3a24',
  primariaSuave: '#e8f3ee',
  primariaBorda: '#cde5d8',
  primariaTransl: '#1b5e3f44',
  erro: '#b3261e',
  erroSuave: '#fdecea',
  erroBorda: '#f5c6c0',
  aviso: '#8a6d00',
  avisoSuave: '#fff8e6',
  avisoBorda: '#ffe69c',
  avisoForte: '#d4a017',
};

// Escuro: mesma identidade feltro, valores derivados dos tokens do painel.
export const CORES_ESCURO: Cores = {
  fundo: '#111613',
  cartao: '#1b231e',
  texto: '#eef3f0',
  textoSuave: '#b6c2bb',
  textoFraco: '#7f8d86',
  brancoFixo: '#fff',
  primaria: '#46b384',
  primariaEscura: '#2f7d5c',
  primariaSuave: '#1d2f26',
  primariaBorda: '#2c4a3b',
  primariaTransl: '#46b38433',
  erro: '#ff8a7a',
  erroSuave: '#2c1714',
  erroBorda: '#54251f',
  aviso: '#e6c35c',
  avisoSuave: '#272009',
  avisoBorda: '#4d3f12',
  avisoForte: '#e0a93f',
};

export type ModoTema = 'auto' | 'claro' | 'escuro';

interface ContextoTema {
  modo: ModoTema;
  setModo: (m: ModoTema) => void;
  escuro: boolean;
  cores: Cores;
}

const TemaContext = createContext<ContextoTema>({
  modo: 'auto',
  setModo: () => {},
  escuro: false,
  cores: CORES_CLARO,
});

export function ProvedorTema({ children }: { children: React.ReactNode }) {
  const sistema = useColorScheme(); // 'light' | 'dark' | null
  const [modo, setModoState] = useState<ModoTema>(() => {
    const salvo = getMeta('tema');
    return salvo === 'claro' || salvo === 'escuro' ? salvo : 'auto';
  });

  const setModo = useCallback((m: ModoTema) => {
    setModoState(m);
    setMeta('tema', m);
  }, []);

  const escuro = modo === 'escuro' || (modo === 'auto' && sistema === 'dark');

  const valor = useMemo<ContextoTema>(
    () => ({ modo, setModo, escuro, cores: escuro ? CORES_ESCURO : CORES_CLARO }),
    [modo, setModo, escuro]
  );

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

/** Cores do tema ativo (para estilos inline e props de componentes). */
export function useCores(): Cores {
  return useContext(TemaContext).cores;
}

/** Modo + setter (tela de Ajustes) e flag escuro (headers etc.). */
export function useTema(): ContextoTema {
  return useContext(TemaContext);
}

/**
 * Fábrica de estilos tematizados:
 *   const useEstilos = criarEstilos((c) => StyleSheet.create({ ... }));
 *   // no componente: const s = useEstilos();
 * O StyleSheet é criado uma vez por tema e cacheado no módulo.
 */
export function criarEstilos<T>(fabrica: (c: Cores) => T): () => T {
  let claro: T | undefined;
  let escuroCache: T | undefined;
  return function useEstilos(): T {
    const { escuro } = useContext(TemaContext);
    if (escuro) {
      if (!escuroCache) escuroCache = fabrica(CORES_ESCURO);
      return escuroCache;
    }
    if (!claro) claro = fabrica(CORES_CLARO);
    return claro;
  };
}
