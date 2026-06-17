'use client';
import { CrudSimples } from '@/components/CrudSimples';
import { AbasCadastros } from '@/components/AbasCadastros';
export default function Page() { return <div className="flex flex-col gap-4"><AbasCadastros /><CrudSimples titulo="Tipos de produto" endpoint="/tipos-produto" campo="nome" rotuloCampo="Nome" perm={{ criar: 'auxiliares.tipos.criar', editar: 'auxiliares.tipos.editar', excluir: 'auxiliares.tipos.excluir' }} /></div>; }
