import { createSessionRepository, createUserRepository } from '@healthy/db';
import type { Database } from '@healthy/db';
import type { UserRow } from '@healthy/db/schema';

import { hashSessionTokenForLookup } from './session-token.js';

function isUserSessionEligible(user: UserRow | undefined): user is UserRow {
  if (user === undefined) {
    return false;
  }
  return user.status === 'active' && user.deletedAt === null;
}

export type AuthMeUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRow['role'];
};

/**
 * Resolves the current user from a raw session token, or `unauthorized`.
 * Updates session `last_used_at` when valid.
 */
export async function resolveAuthMeUser(
  db: Database,
  rawToken: string,
  now: Date = new Date(),
): Promise<AuthMeUser | 'unauthorized'> {
  const tokenHash = hashSessionTokenForLookup(rawToken);
  const sessionRepo = createSessionRepository(db);
  const userRepo = createUserRepository(db);

  const row = await sessionRepo.findSessionByTokenHash(tokenHash);
  if (row === undefined || row.revokedAt !== null) {
    return 'unauthorized';
  }
  if (row.expiresAt.getTime() <= now.getTime()) {
    return 'unauthorized';
  }

  const user = await userRepo.findUserById(row.userId);
  if (!isUserSessionEligible(user)) {
    return 'unauthorized';
  }

  await sessionRepo.setLastUsedAtByTokenHash(tokenHash, now);

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}
