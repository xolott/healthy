import { createSessionRepository, type Database } from '@healthy/db';

import { hashSessionTokenForLookup } from './session-token.js';

/**
 * Revokes the session matching the raw opaque token, if one exists and is not already revoked.
 */
export async function revokeSessionByRawToken(db: Database, rawToken: string, at: Date = new Date()): Promise<void> {
  const tokenHash = hashSessionTokenForLookup(rawToken);
  await createSessionRepository(db).revokeSessionByTokenHash(tokenHash, at);
}
