// Mini-card de resumo usado na linha de stats das seções.
export function MiniStat({ rotulo, valor, cor = 'text-foreground' }: {
  rotulo: string; valor: string | number; cor?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={`text-lg font-bold ${cor}`}>{valor}</p>
    </div>
  );
}
