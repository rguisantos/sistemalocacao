'use client';
import { CrudSimples } from '@/components/CrudSimples';
import { AbasCadastros } from '@/components/AbasCadastros';
export default function Page() { return <div className="flex flex-col gap-4"><AbasCadastros /><CrudSimples titulo="Tamanhos" endpoint="/tamanhos" campo="descricao" rotuloCampo="Descrição" perm={{ criar: 'auxiliares.tamanhos.criar', editar: 'auxiliares.tamanhos.editar', excluir: 'auxiliares.tamanhos.excluir' }} /></div>; }
