// DTOs compartilhados entre API, Web e Mobile
export interface UsuarioDTO {
  id: string;
  nome: string;
  cpf: string;
  ativo: boolean;
  permissoes: string[];
  rotas: { id: string; nome: string }[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioDTO;
}

export interface TelefoneDTO {
  numero: string;
  tipo: 'celular' | 'fixo' | 'whatsapp';
}

export interface ApiError {
  error: string;
  details?: unknown;
}

// ---- Sincronização ----
export interface SyncPushRecord {
  id: string;                // UUID gerado no cliente
  entidade: string;          // nome da tabela
  operacao: 'create' | 'update' | 'delete';
  version: number;           // timestamp ms da última modificação local
  /**
   * Versão que o registro tinha no servidor quando foi baixado (pull).
   * Permite detectar conflito REAL: se baseVersion === versão atual do
   * servidor, ninguém mais editou → aplica direto (fast-forward),
   * mesmo que os timestamps locais sejam "antigos".
   */
  baseVersion?: number;
  dados: Record<string, unknown>;
}

export interface SyncPushRequest {
  deviceId: string;
  registros: SyncPushRecord[];
}

export interface SyncPushResult {
  id: string;
  status: 'applied' | 'merged' | 'conflict' | 'error';
  mensagem?: string;
  /** Em conflito ou merge, estado atual do servidor para o cliente aplicar */
  dadosServidor?: Record<string, unknown>;
}

export interface SyncPullRequest {
  lastSyncTimestamp: number; // ms epoch; 0 = sync total
}

export interface SyncPullResponse {
  timestamp: number;         // novo lastSyncTimestamp do cliente
  entidades: Record<string, unknown[]>; // tabela -> registros alterados
}
