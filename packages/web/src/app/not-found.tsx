'use client';
import { Botao } from '@/components/ui/primitives';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-papel flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-6xl font-display font-bold text-feltro/20">404</p>
        <h1 className="font-display text-xl font-semibold mt-4">Página não encontrada</h1>
        <p className="text-suave text-sm mt-2">A página que você procura não existe ou foi removida.</p>
        <Botao className="mt-6" onClick={() => window.location.href = '/dashboard'}>Voltar ao Painel</Botao>
      </div>
    </div>
  );
}
