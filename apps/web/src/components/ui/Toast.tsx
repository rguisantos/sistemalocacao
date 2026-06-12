'use client';
// Sistema de toasts leve: provider + hook useToast().
// Sucesso/erro com auto-dismiss; pilha no canto inferior direito.
import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastItem {
  id: number;
  titulo: string;
  descricao?: string;
  variante: 'sucesso' | 'erro';
}
interface ToastInput {
  titulo: string;
  descricao?: string;
  variante?: 'sucesso' | 'erro';
}

const ToastContext = createContext<{ toast: (t: ToastInput) => void }>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let proximoId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<ToastItem[]>([]);

  const remover = useCallback((id: number) => {
    setItens((atual) => atual.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((t: ToastInput) => {
    const item: ToastItem = { id: proximoId++, variante: 'sucesso', ...t };
    setItens((atual) => [...atual.slice(-3), item]); // máx. 4 na pilha
    setTimeout(() => remover(item.id), 4500);
  }, [remover]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2 print:hidden">
        {itens.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-card p-3 shadow-lg ${
              t.variante === 'erro' ? 'border-destructive/30' : 'border-primary/25'
            }`}>
            {t.variante === 'erro'
              ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{t.titulo}</p>
              {t.descricao && <p className="mt-0.5 text-xs text-muted-foreground">{t.descricao}</p>}
            </div>
            <button onClick={() => remover(t.id)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
