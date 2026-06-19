'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

interface Sessao { id: string; nome: string; permissoes: string[]; }
interface Ctx { usuario: Sessao | null; carregando: boolean; entrar: (cpf: string, senha: string) => Promise<void>; sair: () => void; pode: (chave: string) => boolean; }
const AuthCtx = createContext<Ctx>({} as Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem('usuario');
    if (raw) setUsuario(JSON.parse(raw));
    setCarregando(false);
  }, []);

  async function entrar(cpf: string, senha: string) {
    const r = await api.login(cpf.replace(/\D/g, ''), senha);
    localStorage.setItem('token', r.accessToken);
    localStorage.setItem('refresh', r.refreshToken);
    localStorage.setItem('usuario', JSON.stringify(r.usuario));
    setUsuario(r.usuario);
    router.push('/dashboard');
  }
  function sair() {
    // Dispara evento para PainelGuard chamar a API de logout
    window.dispatchEvent(new Event('logout-api'));
    ['token', 'refresh', 'usuario'].forEach((k) => localStorage.removeItem(k));
    setUsuario(null); router.push('/login');
  }
  const pode = (chave: string) => !!usuario?.permissoes.includes(chave);

  return <AuthCtx.Provider value={{ usuario, carregando, entrar, sair, pode }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
