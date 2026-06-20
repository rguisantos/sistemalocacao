'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const ABAS = [
  { href: '/tipos-produto', rotulo: 'Tipos' },
  { href: '/tamanhos', rotulo: 'Tamanhos' },
  { href: '/condicoes', rotulo: 'Condições' },
  { href: '/cores', rotulo: 'Cores' },
];
export function AbasCadastros() {
  const caminho = usePathname();
  return (
    <div className="flex gap-2">
      {ABAS.map((a) => (
        <Link key={a.href} href={a.href}
          className={clsx('px-4 py-2 rounded-xl text-sm', caminho === a.href ? 'bg-feltro text-papel' : 'border border-borda')}>
          {a.rotulo}
        </Link>
      ))}
    </div>
  );
}
