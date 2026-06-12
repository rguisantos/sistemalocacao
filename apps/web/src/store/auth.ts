'use client';
import { create } from 'zustand';
import type { UsuarioDTO } from '@locacoes/shared';
import { api, setTokens, clearTokens, restaurarSessao } from '@/lib/api';

interface AuthState {
  usuario: UsuarioDTO | null;
  login: (cpf: string, senha: string) => Promise<void>;
  logout: () => void;
  temPermissao: (chave: string) => boolean;
  /** Reidrata a sessão após reload usando o refreshToken persistido */
  restaurar: () => Promise<UsuarioDTO | null>;
}

export const useAuth = create<AuthState>((set, get) => ({
  usuario: null,
  login: async (cpf, senha) => {
    const data = await api<{ accessToken: string; refreshToken: string; usuario: UsuarioDTO }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ cpf, senha }) }
    );
    setTokens(data.accessToken, data.refreshToken);
    set({ usuario: data.usuario });
  },
  logout: () => {
    clearTokens();
    set({ usuario: null });
  },
  temPermissao: (chave) => get().usuario?.permissoes.includes(chave) ?? false,
  restaurar: async () => {
    const usuario = await restaurarSessao<UsuarioDTO>();
    set({ usuario });
    return usuario;
  },
}));
