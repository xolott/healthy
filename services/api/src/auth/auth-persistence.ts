import { createSessionRepository, createUserRepository, type Database } from '@healthy/db';

/**
 * Session facts for current-session policy (intent-shaped, not raw Drizzle rows).
 */
export type AuthSessionFacts = {
  userId: string;
  revokedAt: Date | null;
  expiresAt: Date;
  lastUsedAt: Date | null;
};

/**
 * User facts for session eligibility (intent-shaped).
 */
export type AuthUserFacts = {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'disabled';
  deletedAt: Date | null;
};

/**
 * Auth-intent persistence seam for the auth slice. Methods are single actions;
 * policy ordering lives in Auth Use Cases.
 */
export type AuthPersistence = {
  findSessionByTokenHash(tokenHash: string): Promise<AuthSessionFacts | undefined>;
  findUserById(userId: string): Promise<AuthUserFacts | undefined>;
  touchSessionLastUsedByTokenHash(tokenHash: string, at: Date): Promise<void>;
  withTransaction<T>(fn: (p: AuthPersistence) => Promise<T>): Promise<T>;
};

function toSessionFacts(row: {
  userId: string;
  revokedAt: Date | null;
  expiresAt: Date;
  lastUsedAt: Date | null;
}): AuthSessionFacts {
  return {
    userId: row.userId,
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
  };
}

function toUserFacts(row: {
  id: string;
  email: string;
  displayName: string;
  role: AuthUserFacts['role'];
  status: AuthUserFacts['status'];
  deletedAt: Date | null;
}): AuthUserFacts {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    deletedAt: row.deletedAt,
  };
}

/**
 * Drizzle-backed adapter composing existing session and user repositories.
 */
export function createDrizzleAuthPersistence(db: Database): AuthPersistence {
  const sessions = createSessionRepository(db);
  const users = createUserRepository(db);

  const self: AuthPersistence = {
    async findSessionByTokenHash(tokenHash) {
      const row = await sessions.findSessionByTokenHash(tokenHash);
      if (row === undefined) {
        return undefined;
      }
      return toSessionFacts(row);
    },

    async findUserById(userId) {
      const row = await users.findUserById(userId);
      if (row === undefined) {
        return undefined;
      }
      return toUserFacts(row);
    },

    async touchSessionLastUsedByTokenHash(tokenHash, at) {
      await sessions.setLastUsedAtByTokenHash(tokenHash, at);
    },

    async withTransaction(fn) {
      return db.transaction(async (tx) => {
        const inner = createDrizzleAuthPersistence(tx);
        return fn(inner);
      });
    },
  };

  return self;
}
