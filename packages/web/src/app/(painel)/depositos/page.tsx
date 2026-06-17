'use client';
import { CrudSimples } from '@/components/CrudSimples';
export default function Page() { return <CrudSimples titulo="Depósitos" endpoint="/depositos" campo="nome" rotuloCampo="Nome" perm={{ criar: 'depositos.criar', editar: 'depositos.editar', excluir: 'depositos.excluir' }} />; }
