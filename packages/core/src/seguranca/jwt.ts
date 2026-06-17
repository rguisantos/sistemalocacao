import jwt from 'jsonwebtoken';

/**
 * Serviço de tokens (decisões da auditoria — P0).
 *
 *  - Secret SEMPRE via variável de ambiente. Sem secret => erro no boot
 *    (nunca cai num default hardcoded).
 *  - Access token curto + refresh token longo.
 *  - REVOGAÇÃO sem estado de blacklist: cada usuário tem `tokenVersao`.
 *    O token carrega a versão; ao validar, comparamos com a versão atual do
 *    usuário. Incrementar `tokenVersao` (logout global, troca de senha,
 *    suspeita de vazamento) invalida instantaneamente todos os tokens antigos.
 */
export interface ConfigToken {
  accessTtl?: string;   // ex.: '15m'
  refreshTtl?: string;  // ex.: '30d'
}

export interface PayloadToken {
  sub: string;          // id do usuário
  tv: number;           // tokenVersao no momento da emissão
  tipo: 'access' | 'refresh';
  permissoes?: string[];
}

function exigirSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET ausente ou fraco. Defina uma variável de ambiente com >= 32 chars.');
  }
  return s;
}

export function emitirTokens(
  usuarioId: string,
  tokenVersao: number,
  permissoes: string[],
  cfg: ConfigToken = {},
): { accessToken: string; refreshToken: string } {
  const secret = exigirSecret();
  const access = jwt.sign(
    { sub: usuarioId, tv: tokenVersao, tipo: 'access', permissoes } satisfies PayloadToken,
    secret,
    { expiresIn: cfg.accessTtl ?? '15m' } as jwt.SignOptions,
  );
  const refresh = jwt.sign(
    { sub: usuarioId, tv: tokenVersao, tipo: 'refresh' } satisfies PayloadToken,
    secret,
    { expiresIn: cfg.refreshTtl ?? '30d' } as jwt.SignOptions,
  );
  return { accessToken: access, refreshToken: refresh };
}

/**
 * Valida o token e confirma que a versão bate com a atual do usuário.
 * `versaoAtualUsuario` deve ser buscada do banco a cada validação (ou cache curto).
 */
export function validarToken(
  token: string,
  versaoAtualUsuario: number,
  tipoEsperado: 'access' | 'refresh' = 'access',
): PayloadToken {
  const secret = exigirSecret();
  const payload = jwt.verify(token, secret) as PayloadToken;
  if (payload.tipo !== tipoEsperado) throw new Error('Tipo de token inválido.');
  if (payload.tv !== versaoAtualUsuario) throw new Error('Token revogado.');
  return payload;
}
