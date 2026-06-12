// Skeletons de carregamento (padrão do design system).
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

export function StatsSkeleton({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 shadow-sm">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-7 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b bg-muted/50 p-3"><Skeleton className="h-4 w-1/3" /></div>
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="border-b p-3 last:border-0"><Skeleton className="h-4 w-full" /></div>
      ))}
    </div>
  );
}
