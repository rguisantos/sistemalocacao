'use client';
import { Botao } from '@/components/ui/primitives';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-papel flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <svg className="w-16 h-16 text-alerta/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <h1 className="font-display text-xl font-semibold">Algo deu errado</h1>
        <p className="text-suave text-sm mt-2">Ocorreu um erro inesperado. Tente novamente.</p>
        <div className="flex gap-3 justify-center mt-6">
          <Botao onClick={reset}>Tentar novamente</Botao>
          <Botao variante="secundario" onClick={() => window.location.href = '/dashboard'}>Voltar ao Painel</Botao>
        </div>
      </div>
    </div>
  );
}
