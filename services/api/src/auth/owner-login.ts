import { createSessionRepository, createUserRepository } from '@healthy/db';
import type { Database } from '@healthy/db';
import type { UserRow } from '@healthy/db/schema';

import { verifyPasswordArgon2id } from './hash-password.js';
import { generateSessionToken } from './session-token.js';

const SESSION_DAYS = 30;

export type OwnerLoginInput = {
  email: string;
  password: string;
};

export type OwnerLoginSuccess = {
  kind: 'success';
  user: Pick<UserRow, 'id' | 'email' | 'displayName' | 'role'>;
  rawSessionToken: string;
  sessionExpiresAt: Date;
};

export type OwnerLoginResult = OwnerLoginSuccess | { kind: 'invalid_credentials' };

function isLoginEligibleOwner(user: UserRow | undefined): user is UserRow {
  if (user === undefined) {
    return false;
  }
  return (
    user.role === 'owner' &&
    user.status === 'active' &&
    user.deletedAt === null
  );
}

/**
 * Authenticates an active, non-deleted owner by email and password.
 * Run inside a transaction. The caller must pass a normalized email (trimmed, non-empty, contains '@').
 * Returns `invalid_credentials` for unknown email, wrong password, non-owner roles, disabled,
 * or soft-deleted accounts.
 */
export async function runOwnerLoginInDb(
  db: Database,
  input: OwnerLoginInput,
  ctx: { ip: string | null; userAgent: string | null },
): Promise<OwnerLoginResult> {
  const email = input.email;
  const password = input.password;

  const userRepo = createUserRepository(db);
  const sessionRepo = createSessionRepository(db);

  const user = await userRepo.findUserByEmail(email);
  if (!isLoginEligibleOwner(user)) {
    return { kind: 'invalid_credentials' };
  }

  const passwordOk = await verifyPasswordArgon2id(password, user.passwordHash);
  if (!passwordOk) {
    return { kind: 'invalid_credentials' };
  }

  const { rawToken, tokenHash } = generateSessionToken();
  const now = new Date();
  const sessionExpiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await sessionRepo.createSession({
    userId: user.id,
    tokenHash,
    expiresAt: sessionExpiresAt,
    lastUsedAt: now,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  await userRepo.setLastLoginAt(user.id, now);

  return {
    kind: 'success',
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
    rawSessionToken: rawToken,
    sessionExpiresAt,
  };
}
