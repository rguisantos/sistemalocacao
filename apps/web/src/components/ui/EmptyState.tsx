// Estado vazio com ícone e ação opcional (padrão do design system).
import type { LucideIcon } from 'lucide-react';

interface Props {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  acao?: { rotulo: string; onClick: () => void };
}

export function EmptyState({ icone: Icone, titulo, descricao, acao }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10">
        <Icone className="h-7 w-7 text-primary/60" />
      </div>
      <p className="font-semibold">{titulo}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descricao}</p>
      {acao && (
        <button onClick={acao.onClick}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {acao.rotulo}
        </button>
      )}
    </div>
  );
}
