import type { AuthPersistence, AuthSessionFacts, AuthUserFacts } from './auth-persistence.js';

export type MemoryAuthSessionRecord = AuthSessionFacts;

/**
 * Mutable backing store for {@link createMemoryAuthPersistence}.
 */
export type MemoryAuthPersistenceStore = {
  sessionsByTokenHash: Map<string, MemoryAuthSessionRecord>;
  usersById: Map<string, AuthUserFacts>;
};

export function createMemoryAuthPersistenceStore(): MemoryAuthPersistenceStore {
  return {
    sessionsByTokenHash: new Map(),
    usersById: new Map(),
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

    async withTransaction(fn) {
      return fn(createMemoryAuthPersistence(store));
    },
  };

  return self;
}
