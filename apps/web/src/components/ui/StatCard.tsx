// Card de KPI no padrão do design system (ícone + rótulo + valor + nota).
import type { LucideIcon } from 'lucide-react';

interface Props {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  nota?: string;
  tom?: 'padrao' | 'alerta' | 'perigo';
}

export function StatCard({ icone: Icone, rotulo, valor, nota, tom = 'padrao' }: Props) {
  const corValor =
    tom === 'perigo' ? 'text-destructive' : tom === 'alerta' ? 'text-amber-600' : 'text-foreground';
  const corIcone =
    tom === 'perigo' ? 'bg-destructive/10 text-destructive'
    : tom === 'alerta' ? 'bg-amber-500/10 text-amber-600'
    : 'bg-primary/10 text-primary';
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rotulo}</p>
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${corIcone}`}>
          <Icone className="h-4 w-4" />
        </div>
      </div>
      <p className={`mt-1 text-2xl font-bold ${corValor}`}>{valor}</p>
      {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}
