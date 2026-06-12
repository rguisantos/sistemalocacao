// Badge de status com variantes semânticas.
const VARIANTES = {
  success: 'bg-primary/10 text-primary border-primary/20',
  warning: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  destructive: 'bg-destructive/10 text-destructive border-destructive/25',
  muted: 'bg-muted text-muted-foreground border-transparent',
  outline: 'bg-transparent text-foreground/80 border-border',
} as const;

export function Badge({ variante = 'muted', children }: {
  variante?: keyof typeof VARIANTES; children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${VARIANTES[variante]}`}>
      {children}
    </span>
  );
}
