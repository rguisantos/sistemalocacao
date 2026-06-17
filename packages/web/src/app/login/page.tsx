'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Botao, Campo } from '@/components/ui/primitives';

export default function Login() {
  const { entrar } = useAuth();
  const [cpf, setCpf] = useState(''); const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(''); const [carregando, setCarregando] = useState(false);

  async function submeter(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true);
    try { await entrar(cpf, senha); } catch (err: any) { setErro(err.message); } finally { setCarregando(false); }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-feltro p-6">
      <form onSubmit={submeter} className="bg-white rounded-xl p-8 w-full max-w-sm shadow-xl flex flex-col gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-feltro">Locações</h1>
          <p className="text-suave text-sm">Painel administrativo</p>
        </div>
        <Campo label="CPF" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
        <Campo label="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        {erro && <p className="text-alerta text-sm">{erro}</p>}
        <Botao type="submit" disabled={carregando}>{carregando ? 'Entrando…' : 'Entrar'}</Botao>
      </form>
    </main>
  );
}
