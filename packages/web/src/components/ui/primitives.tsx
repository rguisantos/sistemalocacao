'use client';
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export function Botao({ variante = 'primario', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'perigo' }) {
  const estilos = {
    primario: 'bg-feltro text-papel hover:bg-feltro-claro',
    secundario: 'border border-borda text-tinta hover:bg-papel',
    perigo: 'bg-alerta text-white hover:opacity-90',
  }[variante];
  return <button {...p} className={clsx('px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50', estilos, className)} />;
}

export function Campo({ label, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="text-suave font-medium">{label}</span>}
      <input {...p} className={clsx('border border-borda rounded-xl px-3 py-2 bg-white focus:border-latao', className)} />
    </label>
  );
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('bg-white border border-borda rounded-xl p-5', className)}>{children}</div>;
}

export function Dialogo({ aberto, aoFechar, titulo, children }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode }) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/40 p-4" onClick={aoFechar}>
      <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold mb-4">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

export function Tabela({ colunas, children }: { colunas: string[]; children: ReactNode }) {
  return (
    <div className="bg-white border border-borda rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-papel text-suave text-left">
          <tr>{colunas.map((c) => <th key={c} className="px-4 py-3 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-borda">{children}</tbody>
      </table>
    </div>
  );
}
