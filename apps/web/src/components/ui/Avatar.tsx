// Avatar circular com a inicial do nome.
export function Avatar({ nome }: { nome: string }) {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {(nome ?? '?').trim().charAt(0).toUpperCase()}
    </div>
  );
}
