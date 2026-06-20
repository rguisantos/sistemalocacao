'use client';
import { CrudSimples } from '@/components/CrudSimples';
import { AbasCadastros } from '@/components/AbasCadastros';
export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <AbasCadastros />
      <CrudSimples titulo="Cores" endpoint="/cores" campo="nome" rotuloCampo="Nome da cor"
        perm={{ criar: 'auxiliares.cores.criar', editar: 'auxiliares.cores.editar', excluir: 'auxiliares.cores.excluir' }} />
    </div>
  );
}
