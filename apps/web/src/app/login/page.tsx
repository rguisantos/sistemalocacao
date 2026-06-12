'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro('');
    setCarregando(true);
    try {
      await login(cpf.replace(/\D/g, ''), senha);
      router.push('/painel');
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Falha no login');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-feltro">
      <div className="w-full max-w-sm rounded-xl bg-giz p-8 shadow-2xl">
        <h1 className="mb-1 text-2xl font-bold text-feltro">Sistema de Locações</h1>
        <p className="mb-6 text-sm text-stone-500">Acesse com seu CPF e senha</p>

        <label className="mb-1 block text-sm font-medium">CPF</label>
        <input
          className="mb-4 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:ring-2 focus:ring-feltro"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          placeholder="Somente números"
          inputMode="numeric"
          maxLength={11}
        />

        <label className="mb-1 block text-sm font-medium">Senha</label>
        <input
          type="password"
          className="mb-4 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:ring-2 focus:ring-feltro"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && entrar()}
        />

        {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}

        <button
          onClick={entrar}
          disabled={carregando}
          className="w-full rounded-lg bg-feltro py-2.5 font-semibold text-white transition hover:bg-feltro-claro disabled:opacity-50"
        >
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </main>
  );
}
