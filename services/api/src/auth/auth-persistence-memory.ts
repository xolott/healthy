import { normalizeEmail } from '@healthy/db';

import type {
  AuthPersistence,
  AuthSessionFacts,
  AuthUserFacts,
  AuthUserForOwnerLogin,
  OwnerLoginSessionInsert,
} from './auth-persistence.js';

export type MemoryAuthSessionRecord = AuthSessionFacts;

/**
 * Mutable backing store for {@link createMemoryAuthPersistence}.
 */
export type MemoryAuthPersistenceStore = {
  sessionsByTokenHash: Map<string, MemoryAuthSessionRecord>;
  usersById: Map<string, AuthUserFacts>;
  /** Normalized email (see {@link normalizeEmail}) → user row for owner login tests. */
  usersByEmailForLogin: Map<string, AuthUserForOwnerLogin>;
  lastLoginAtByUserId: Map<string, Date>;
};

export function createMemoryAuthPersistenceStore(): MemoryAuthPersistenceStore {
  return {
    sessionsByTokenHash: new Map(),
    usersById: new Map(),
    usersByEmailForLogin: new Map(),
    lastLoginAtByUserId: new Map(),
  };
}

/**
 * In-memory Auth Persistence for fast deterministic policy tests.
 */
export function createMemoryAuthPersistence(store: MemoryAuthPersistenceStore): AuthPersistence {
  const self: AuthPersistence = {
    async findSessionByTokenHash(tokenHash) {
      const row = store.sessionsByTokenHash.get(tokenHash);
      return row === undefined ? undefined : { ...row };
    },

    async findUserById(userId) {
      const row = store.usersById.get(userId);
      return row === undefined ? undefined : { ...row };
    },

    async touchSessionLastUsedByTokenHash(tokenHash, at) {
      const row = store.sessionsByTokenHash.get(tokenHash);
      if (row !== undefined) {
        row.lastUsedAt = at;
      }
    },

    async findUserForOwnerLoginByEmail(email) {
      const key = normalizeEmail(email);
      const row = store.usersByEmailForLogin.get(key);
      return row === undefined ? undefined : { ...row };
    },

    async createOwnerLoginSession(input: OwnerLoginSessionInsert) {
      store.sessionsByTokenHash.set(input.tokenHash, {
        userId: input.userId,
        revokedAt: null,
        expiresAt: input.expiresAt,
        lastUsedAt: input.lastUsedAt,
      });
    },

    async setOwnerLastLoginAt(userId, at) {
      store.lastLoginAtByUserId.set(userId, at);
    },

    async withTransaction(fn) {
      return fn(createMemoryAuthPersistence(store));
    },
  };

  return self;
}
