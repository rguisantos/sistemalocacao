'use client';
import { CrudSimples } from '@/components/CrudSimples';
export default function Page() { return <CrudSimples titulo="Rotas" endpoint="/rotas" campo="nome" rotuloCampo="Nome" perm={{ criar: 'rotas.criar', editar: 'rotas.editar', excluir: 'rotas.excluir' }} />; }
