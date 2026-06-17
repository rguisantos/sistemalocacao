/** Registro das entidades sincronizáveis: chave do servidor -> tabela local. */
export interface RegistroEntidade { entidade: string; tabela: string; pushable: boolean; appendOnly?: boolean; }

export const REGISTROS: RegistroEntidade[] = [
  { entidade: 'rota', tabela: 'rota', pushable: false },
  { entidade: 'tipoProduto', tabela: 'tipo_produto', pushable: false },
  { entidade: 'tamanho', tabela: 'tamanho', pushable: false },
  { entidade: 'condicao', tabela: 'condicao', pushable: false },
  { entidade: 'deposito', tabela: 'deposito', pushable: false },
  { entidade: 'produto', tabela: 'produto', pushable: true },
  { entidade: 'cliente', tabela: 'cliente', pushable: true },
  { entidade: 'endereco', tabela: 'endereco', pushable: true },
  { entidade: 'locacao', tabela: 'locacao', pushable: true },
  { entidade: 'cobranca', tabela: 'cobranca', pushable: true, appendOnly: true },
  { entidade: 'pagamento', tabela: 'pagamento', pushable: true, appendOnly: true },
  { entidade: 'saldoDevedorLocacao', tabela: 'saldo_devedor_locacao', pushable: true },
  { entidade: 'manutencao', tabela: 'manutencao', pushable: true },
  { entidade: 'usuario', tabela: 'usuario', pushable: true },
];
export const PORTABELA: Record<string, RegistroEntidade> = Object.fromEntries(REGISTROS.map((r) => [r.entidade, r]));

/** Campos booleanos guardados como 0/1 no SQLite e enviados como boolean ao servidor. */
export const CAMPOS_BOOL = new Set(['trocaPano', 'contadorReiniciado']);
/** Campos JSON guardados como texto no SQLite. */
export const CAMPOS_JSON = new Set(['telefones']);
