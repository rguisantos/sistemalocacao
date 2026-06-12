// Campo de busca com ícone embutido.
import { Search } from 'lucide-react';

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input {...props} className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm ${props.className ?? ''}`} />
    </div>
  );
}
