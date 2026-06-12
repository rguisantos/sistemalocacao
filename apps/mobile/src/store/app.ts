import { create } from 'zustand';
import type { UsuarioLocal } from '../services/auth';

interface AppState {
  usuario: UsuarioLocal | null;
  setUsuario: (u: UsuarioLocal | null) => void;
  temPermissao: (chave: string) => boolean;
  pendentes: number;
  setPendentes: (n: number) => void;
}

export const useApp = create<AppState>((set, get) => ({
  usuario: null,
  setUsuario: (usuario) => set({ usuario }),
  temPermissao: (chave) => get().usuario?.permissoes.includes(chave) ?? false,
  pendentes: 0,
  setPendentes: (pendentes) => set({ pendentes }),
}));
