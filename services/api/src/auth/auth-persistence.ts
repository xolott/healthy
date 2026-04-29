import { and, count, eq, isNull } from 'drizzle-orm';

import type { Database } from '@healthy/db';
import {
  sessions as sessionsTable,
  users as usersTable,
  type UserRow,
} from '@healthy/db/schema';

/**
 * How persisted auth matches stored `users.email` (trim + lowercase).
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

/** Unique violation — e.g. concurrent first-owner setups racing on the same email. */
function isPgUniqueViolation(e: unknown): boolean {
  let current: unknown = e;
  for (let depth = 0; depth < 8 && current !== null && current !== undefined; depth += 1) {
    if (typeof current === 'object' && 'code' in current && (current as { code: unknown }).code === '23505') {
      return true;
    }
    if (typeof current === 'object' && current !== null && 'cause' in current) {
      current = (current as { cause: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}

/**
 * Drizzle-backed adapter. Session and user reads/writes use Drizzle on `sessions` / `users`;
 * first-owner bootstrap matches prior repository semantics (active-owner gate + unique handling).
 */
export function createDrizzleAuthPersistence(db: Database): AuthPersistence {
  const self: AuthPersistence = {
    async findSessionByTokenHash(tokenHash) {
      const rows = await db
        .select({
          userId: sessionsTable.userId,
          revokedAt: sessionsTable.revokedAt,
          expiresAt: sessionsTable.expiresAt,
          lastUsedAt: sessionsTable.lastUsedAt,
        })
        .from(sessionsTable)
        .where(eq(sessionsTable.tokenHash, tokenHash))
        .limit(1);
      const row = rows[0];
      if (row === undefined) {
        return undefined;
      }
      return toSessionFacts(row);
    },

    async revokeSessionByTokenHash(tokenHash, at) {
      const rows = await db
        .update(sessionsTable)
        .set({ revokedAt: at })
        .where(and(eq(sessionsTable.tokenHash, tokenHash), isNull(sessionsTable.revokedAt)))
        .returning();
      return { revoked: rows[0] !== undefined };
    },

    async findUserById(userId) {
      const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const row = rows[0];
      if (row === undefined) {
        return undefined;
      }
      return toUserFacts(row);
    },

    async touchSessionLastUsedByTokenHash(tokenHash, at) {
      await db.update(sessionsTable).set({ lastUsedAt: at }).where(eq(sessionsTable.tokenHash, tokenHash));
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
      const [row] = await db
        .select({ n: count() })
        .from(usersTable)
        .where(
          and(eq(usersTable.role, 'owner'), eq(usersTable.status, 'active'), isNull(usersTable.deletedAt)),
        );
      return Number(row?.n ?? 0) > 0;
    },

    async createFirstOwnerIfNoneExists(input) {
      const [countRow] = await db
        .select({ n: count() })
        .from(usersTable)
        .where(
          and(eq(usersTable.role, 'owner'), eq(usersTable.status, 'active'), isNull(usersTable.deletedAt)),
        );
      if (Number(countRow?.n ?? 0) > 0) {
        return { kind: 'already_exists' };
      }
      const normalized = canonicalizeAuthEmailForPersistence(input.email);
      const now = new Date();
      try {
        const rows = await db
          .insert(usersTable)
          .values({
            email: normalized,
            passwordHash: input.passwordHash,
            displayName: input.displayName,
            role: 'owner',
            status: 'active',
            updatedAt: now,
          })
          .returning();
        const row = rows[0];
        if (row === undefined) {
          throw new Error('insert did not return a row');
        }
        return { kind: 'created', user: toUserFacts(row) };
      } catch (e) {
        if (isPgUniqueViolation(e)) {
          return { kind: 'already_exists' };
        }
        throw e;
      }
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
