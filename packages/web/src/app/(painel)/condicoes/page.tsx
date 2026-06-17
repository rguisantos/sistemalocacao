'use client';
import { CrudSimples } from '@/components/CrudSimples';
import { AbasCadastros } from '@/components/AbasCadastros';
export default function Page() { return <div className="flex flex-col gap-4"><AbasCadastros /><CrudSimples titulo="Condições" endpoint="/condicoes" campo="descricao" rotuloCampo="Descrição" perm={{ criar: 'auxiliares.condicoes.criar', editar: 'auxiliares.condicoes.editar', excluir: 'auxiliares.condicoes.excluir' }} /></div>; }
