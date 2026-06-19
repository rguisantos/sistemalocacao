'use client';
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, useEffect, useRef, useCallback, useState, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

/* ─── BOTÃO ─── */
export function Botao({ variante = 'primario', tamanho = 'md', loading, icon: Icon, className, children, disabled, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'perigo' | 'fantasma'; tamanho?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: React.ComponentType<any>;
}) {
  const tamanhos = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const estilos = {
    primario: 'bg-feltro text-papel hover:bg-feltro-claro shadow-sm',
    secundario: 'border border-borda text-tinta hover:bg-papel',
    perigo: 'bg-alerta text-white hover:opacity-90',
    fantasma: 'text-suave hover:bg-papel hover:text-tinta',
  }[variante];
  return (
    <button {...p} disabled={disabled || loading} className={clsx('inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50', tamanhos[tamanho], estilos, className)}>
      {loading ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

/* ─── CAMPO (Input) ─── */
export function Campo({ label, erro, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label?: string; erro?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="text-suave font-medium">{label}</span>}
      <input {...p} className={clsx('border rounded-xl px-3 py-2 bg-white transition', erro ? 'border-alerta focus:ring-alerta/30' : 'border-borda focus:border-latao focus:ring-latao/20', className)} />
      {erro && <span className="text-alerta text-xs">{erro}</span>}
    </label>
  );
}

/* ─── SELECT ─── */
export function Select({ label, erro, children, className, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; erro?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="text-suave font-medium">{label}</span>}
      <select {...p} className={clsx('border rounded-xl px-3 py-2 bg-white transition appearance-none', erro ? 'border-alerta' : 'border-borda focus:border-latao', className)}>
        {children}
      </select>
      {erro && <span className="text-alerta text-xs">{erro}</span>}
    </label>
  );
}

/* ─── TEXTAREA ─── */
export function Textarea({ label, erro, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; erro?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="text-suave font-medium">{label}</span>}
      <textarea {...p} className={clsx('border rounded-xl px-3 py-2 bg-white transition resize-y min-h-[80px]', erro ? 'border-alerta' : 'border-borda focus:border-latao', className)} />
      {erro && <span className="text-alerta text-xs">{erro}</span>}
    </label>
  );
}

/* ─── CHECKBOX ─── */
export function Checkbox({ label, className, ...p }: { label?: string; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={clsx('inline-flex items-center gap-2 text-sm cursor-pointer', className)}>
      <input type="checkbox" {...p} className="w-4 h-4 rounded border-borda text-feltro focus:ring-latao accent-feltro" />
      {label && <span>{label}</span>}
    </label>
  );
}

/* ─── CARTÃO ─── */
export function Cartao({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={clsx('bg-white border border-borda rounded-xl p-5', hover && 'hover:shadow-md transition-shadow', className)}>{children}</div>;
}

/* ─── TABELA ─── */
export function Tabela({ colunas, children, vazio }: { colunas: string[]; children: ReactNode; vazio?: string }) {
  const hasRows = React.Children.count(children) > 0;
  return (
    <div className="bg-white border border-borda rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-papel text-suave text-left">
            <tr>{colunas.map((c) => <th key={c} className="px-4 py-3 font-medium whitespace-nowrap">{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-borda">{children}</tbody>
        </table>
      </div>
      {!hasRows && vazio && (
        <div className="px-4 py-12 text-center text-suave">{vazio}</div>
      )}
    </div>
  );
}

/* ─── BADGE ─── */
type BadgeVar = 'verde' | 'vermelho' | 'amarelo' | 'azul' | 'cinza' | 'roxo';
const badgeCores: Record<BadgeVar, string> = {
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  vermelho: 'bg-red-50 text-red-700 ring-red-200',
  amarelo: 'bg-amber-50 text-amber-700 ring-amber-200',
  azul: 'bg-blue-50 text-blue-700 ring-blue-200',
  cinza: 'bg-gray-50 text-gray-600 ring-gray-200',
  roxo: 'bg-purple-50 text-purple-700 ring-purple-200',
};
export function Badge({ var: v = 'cinza', children, className }: { var?: BadgeVar; children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', badgeCores[v], className)}>{children}</span>;
}

/* ─── BADGES DE DOMÍNIO ─── */
export function StatusPagamentoBadge({ status }: { status: string }) {
  const m: Record<string, BadgeVar> = { PAGO: 'verde', PARCIAL: 'amarelo', PENDENTE: 'azul', ATRASADO: 'vermelho' };
  return <Badge var={m[status] || 'cinza'}>{status}</Badge>;
}
export function StatusLocacaoBadge({ status }: { status: string }) {
  const m: Record<string, BadgeVar> = { ATIVA: 'verde', FINALIZADA: 'cinza' };
  return <Badge var={m[status] || 'cinza'}>{status}</Badge>;
}
export function StatusSaldoBadge({ status }: { status: string }) {
  const m: Record<string, BadgeVar> = { PENDENTE: 'vermelho', QUITADO: 'verde' };
  return <Badge var={m[status] || 'cinza'}>{status}</Badge>;
}

/* ─── MODAL (Portal + Focus Trap + ESC) ─── */
export function Modal({ aberto, aoFechar, titulo, children, tamanho = 'md' }: {
  aberto: boolean; aoFechar: () => void; titulo?: string; children: ReactNode; tamanho?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tama = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[tamanho];

  // ESC key
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [aberto, aoFechar]);

  // Scroll lock + focus trap
  useEffect(() => {
    if (!aberto) return;
    document.body.style.overflow = 'hidden';
    const prev = document.activeElement as HTMLElement;
    ref.current?.focus();
    return () => { document.body.style.overflow = ''; prev?.focus?.(); };
  }, [aberto]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/40 p-4 animate-in fade-in duration-200" onClick={aoFechar}>
      <div ref={ref} tabIndex={-1} className={clsx('bg-white rounded-xl w-full shadow-xl animate-in zoom-in-95 duration-200', tama)} onClick={(e) => e.stopPropagation()}>
        {titulo && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-borda">
            <h2 className="font-display text-lg font-semibold">{titulo}</h2>
            <button onClick={aoFechar} className="text-suave hover:text-tinta transition p-1 rounded-lg hover:bg-papel"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ─── CONFIRM MODAL ─── */
export function ConfirmModal({ aberto, aoFechar, onConfirm, titulo, mensagem, variante = 'perigo', loading }: {
  aberto: boolean; aoFechar: () => void; onConfirm: () => void; titulo: string; mensagem: string; variante?: 'perigo' | 'aviso' | 'info'; loading?: boolean;
}) {
  const icones = {
    perigo: <svg className="w-10 h-10 text-alerta" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>,
    aviso: <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>,
    info: <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>,
  };
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} tamanho="sm">
      <div className="flex flex-col items-center text-center gap-4">
        {icones[variante]}
        <h3 className="font-display text-lg font-semibold">{titulo}</h3>
        <p className="text-suave text-sm">{mensagem}</p>
        <div className="flex gap-3 w-full mt-2">
          <Botao variante="secundario" className="flex-1" onClick={aoFechar} disabled={loading}>Cancelar</Botao>
          <Botao variante={variante === 'perigo' ? 'perigo' : 'primario'} className="flex-1" onClick={onConfirm} loading={loading}>Confirmar</Botao>
        </div>
      </div>
    </Modal>
  );
}

/* ─── PAGINAÇÃO ─── */
export function Paginacao({ pagina, total, limite, onChange }: { pagina: number; total: number; limite: number; onChange: (p: number) => void }) {
  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  if (totalPaginas <= 1) return null;
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-suave">
      <span>{total} registro{total !== 1 ? 's' : ''}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(pagina - 1)} disabled={pagina <= 1} className="p-2 rounded-lg hover:bg-papel disabled:opacity-30 transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="px-3 font-medium text-tinta">{pagina} / {totalPaginas}</span>
        <button onClick={() => onChange(pagina + 1)} disabled={pagina >= totalPaginas} className="p-2 rounded-lg hover:bg-papel disabled:opacity-30 transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ─── TOAST ─── */
type ToastTipo = 'sucesso' | 'erro' | 'aviso' | 'info';
let toastId = 0;
const ouvintes: Set<(t: ToastItem) => void> = new Set();
interface ToastItem { id: number; tipo: ToastTipo; msg: string; }

export function toast(msg: string, tipo: ToastTipo = 'info') {
  const item: ToastItem = { id: ++toastId, tipo, msg };
  ouvintes.forEach((fn) => fn(item));
  setTimeout(() => {
    const remove: ToastItem = { ...item, _rm: true } as any;
    ouvintes.forEach((fn) => fn(remove));
  }, 5000);
}

export function Toaster() {
  const [itens, setItens] = useState<ToastItem[]>([]);
  useEffect(() => {
    const fn = (t: ToastItem) => {
      if ((t as any)._rm) setItens((prev) => prev.filter((i) => i.id !== t.id));
      else setItens((prev) => [...prev, t]);
    };
    ouvintes.add(fn);
    return () => { ouvintes.delete(fn); };
  }, []);
  const cores: Record<ToastTipo, string> = {
    sucesso: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    erro: 'bg-red-50 border-red-200 text-red-800',
    aviso: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {itens.map((t) => (
        <div key={t.id} className={clsx('px-4 py-3 rounded-xl border text-sm shadow-lg animate-in slide-in-from-right pointer-events-auto', cores[t.tipo])}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ─── SKELETON ─── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse bg-papel rounded-xl', className)} />;
}
export function SkeletonCard() {
  return <div className="bg-white border border-borda rounded-xl p-5 space-y-3"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>;
}
export function SkeletonTable({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="bg-white border border-borda rounded-xl overflow-hidden">
      <div className="bg-papel px-4 py-3"><Skeleton className="h-4 w-1/4" /></div>
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-t border-borda flex gap-4"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-1/5" /></div>
      ))}
    </div>
  );
}

/* ─── EMPTY STATE ─── */
export function EmptyState({ icone, titulo, descricao, acao }: { icone?: ReactNode; titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icone && <div className="text-suave/40 mb-4">{icone}</div>}
      <h3 className="font-display font-semibold text-tinta mb-1">{titulo}</h3>
      {descricao && <p className="text-suave text-sm max-w-sm">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

/* ─── KPI CARD ─── */
export function KpiCard({ titulo, valor, tendencia, icone: Icon, cor = 'feltro' }: {
  titulo: string; valor: string; tendencia?: { valor: number; positivo: boolean }; icone?: React.ComponentType<any>; cor?: string;
}) {
  const cores: Record<string, string> = { feltro: 'bg-feltro/5 text-feltro', latao: 'bg-latao/10 text-latao', alerta: 'bg-alerta/10 text-alerta' };
  return (
    <Cartao className="flex items-start justify-between">
      <div>
        <p className="text-suave text-sm">{titulo}</p>
        <p className={clsx('text-2xl font-semibold mt-1', cor === 'latao' ? 'text-latao' : cor === 'alerta' ? 'text-alerta' : 'text-tinta')}>{valor}</p>
        {tendencia && (
          <p className={clsx('text-xs mt-1 flex items-center gap-1', tendencia.positivo ? 'text-emerald-600' : 'text-alerta')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={tendencia.positivo ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}/></svg>
            {tendencia.valor}%
          </p>
        )}
      </div>
      {Icon && <div className={clsx('p-3 rounded-xl', cores[cor] || cores.feltro)}><Icon size={20} /></div>}
    </Cartao>
  );
}

/* ─── HEADER DE PÁGINA ─── */
export function Header({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: string; acoes?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="font-display text-2xl font-bold">{titulo}</h1>
        {subtitulo && <p className="text-suave text-sm mt-1">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2 flex-shrink-0">{acoes}</div>}
    </div>
  );
}

/* ─── SEARCH INPUT ─── */
export function SearchInput({ valor, onChange, placeholder = 'Buscar...', className }: { valor: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={clsx('relative', className)}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-suave" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input type="text" value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 border border-borda rounded-xl text-sm bg-white focus:border-latao transition" />
    </div>
  );
}

/* ─── TABS ─── */
export function Tabs({ abas, ativa, onChange }: { abas: { id: string; rotulo: string }[]; ativa: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-borda -mb-px">
      {abas.map((a) => (
        <button key={a.id} onClick={() => onChange(a.id)}
          className={clsx('px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px',
            ativa === a.id ? 'border-feltro text-feltro' : 'border-transparent text-suave hover:text-tinta')}>
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}

/* ─── DIALOGO (mantido para compatibilidade, redireciona para Modal) ─── */
export function Dialogo({ aberto, aoFechar, titulo, children }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode }) {
  return <Modal aberto={aberto} aoFechar={aoFechar} titulo={titulo}>{children}</Modal>;
}

// Re-export React for Tabela's React.Children usage
import React from 'react';
