import { eq } from 'drizzle-orm';

import { createSessionRepository, createUserRepository, type Database } from '@healthy/db';
import { sessions as sessionsTable, users as usersTable, type UserRow } from '@healthy/db/schema';

/**
 * How persisted auth matches stored `users.email` (trim + lowercase).
 * Kept in the auth slice; user inserts in @healthy/db use the same rules internally.
 */
export function canonicalizeAuthEmailForPersistence(email: string): string {
  return email.trim().toLowerCase();
}

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
 * User facts plus stored password hash for owner login verification.
 */
export type AuthUserForOwnerLogin = AuthUserFacts & {
  passwordHash: string;
};

export type OwnerLoginSessionInsert = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

/**
 * Auth-intent persistence seam for the auth slice. Methods are single actions;
 * policy ordering lives in Auth Use Cases.
 */
export type CreateFirstOwnerUserInput = {
  email: string;
  displayName: string;
  passwordHash: string;
};

export type CreateFirstOwnerIfNoneExistsOutcome =
  | { kind: 'created'; user: AuthUserFacts }
  | { kind: 'already_exists' };

export type AuthPersistence = {
  findSessionByTokenHash(tokenHash: string): Promise<AuthSessionFacts | undefined>;
  /**
   * Revokes by stored token hash when present and not yet revoked.
   * Returns whether a row was updated (same semantics as session repository revoke).
   */
  revokeSessionByTokenHash(tokenHash: string, at: Date): Promise<{ revoked: boolean }>;
  findUserById(userId: string): Promise<AuthUserFacts | undefined>;
  touchSessionLastUsedByTokenHash(tokenHash: string, at: Date): Promise<void>;
  findUserForOwnerLoginByEmail(email: string): Promise<AuthUserForOwnerLogin | undefined>;
  createOwnerLoginSession(input: OwnerLoginSessionInsert): Promise<void>;
  setOwnerLastLoginAt(userId: string, at: Date): Promise<void>;
  hasActiveOwner(): Promise<boolean>;
  /** Closed outcome; no thrown errors for “owner already present” / duplicate-email race. */
  createFirstOwnerIfNoneExists(
    input: CreateFirstOwnerUserInput,
  ): Promise<CreateFirstOwnerIfNoneExistsOutcome>;
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

function toUserForOwnerLogin(row: UserRow): AuthUserForOwnerLogin {
  return {
    ...toUserFacts(row),
    passwordHash: row.passwordHash,
  };
}

/**
 * Drizzle-backed adapter. Owner-login persistence queries run directly on `users` / `sessions`;
 * other paths compose the package session and user repositories.
 */
export function createDrizzleAuthPersistence(db: Database): AuthPersistence {
  const sessionRepo = createSessionRepository(db);
  const userRepo = createUserRepository(db);

  const self: AuthPersistence = {
    async findSessionByTokenHash(tokenHash) {
      const row = await sessionRepo.findSessionByTokenHash(tokenHash);
      if (row === undefined) {
        return undefined;
      }
      return toSessionFacts(row);
    },

    async revokeSessionByTokenHash(tokenHash, at) {
      const row = await sessionRepo.revokeSessionByTokenHash(tokenHash, at);
      return { revoked: row !== undefined };
    },

    async findUserById(userId) {
      const row = await userRepo.findUserById(userId);
      if (row === undefined) {
        return undefined;
      }
      return toUserFacts(row);
    },

    async touchSessionLastUsedByTokenHash(tokenHash, at) {
      await sessionRepo.setLastUsedAtByTokenHash(tokenHash, at);
    },

    async findUserForOwnerLoginByEmail(email) {
      const key = canonicalizeAuthEmailForPersistence(email);
      const rows = await db.select().from(usersTable).where(eq(usersTable.email, key)).limit(1);
      const row = rows[0];
      if (row === undefined) {
        return undefined;
      }
      return toUserForOwnerLogin(row);
    },

    async createOwnerLoginSession(input) {
      const [row] = await db
        .insert(sessionsTable)
        .values({
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          lastUsedAt: input.lastUsedAt,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        })
        .returning();
      if (row === undefined) {
        throw new Error('insert did not return a row');
      }
    },

    async setOwnerLastLoginAt(userId, at) {
      const now = new Date();
      await db
        .update(usersTable)
        .set({ lastLoginAt: at, updatedAt: now })
        .where(eq(usersTable.id, userId));
    },

    async hasActiveOwner() {
      return userRepo.hasActiveOwner();
    },

    async createFirstOwnerIfNoneExists(input) {
      const outcome = await userRepo.createFirstOwnerIfNoneExists({
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
      });
      if (outcome.kind === 'already_exists') {
        return { kind: 'already_exists' };
      }
      return { kind: 'created', user: toUserFacts(outcome.row) };
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
