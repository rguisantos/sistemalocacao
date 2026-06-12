// Cabeçalho de seção: ícone em caixa + título + descrição + ações.
import type { LucideIcon } from 'lucide-react';

interface Props {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  children?: React.ReactNode; // ações à direita
}

export function PageHeader({ icone: Icone, titulo, descricao, children }: Props) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5">
          <Icone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
