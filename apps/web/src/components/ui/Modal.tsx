// Diálogo leve (sem Radix): overlay, ESC e clique-fora fecham.
'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  fechar: () => void;
  children: React.ReactNode;
  larguraMax?: string;
}

export function Modal({ aberto, titulo, descricao, fechar, children, larguraMax = 'max-w-lg' }: Props) {
  useEffect(() => {
    if (!aberto) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    document.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [aberto, fechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={fechar} />
      <div className={`relative w-full ${larguraMax} max-h-[90vh] overflow-y-auto rounded-xl border bg-card p-6 shadow-xl`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>}
          </div>
          <button onClick={fechar} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
