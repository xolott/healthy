import { createHash, randomBytes } from 'node:crypto';

export const SESSION_TOKEN_BYTES = 32;
export const SESSION_COOKIE_NAME = 'healthy_session' as const;

/**
 * Opaque session token and SHA-256 hex digest stored in `sessions.token_hash`.
 */
export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
  return { rawToken, tokenHash };
}

export function hashSessionTokenForLookup(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}
