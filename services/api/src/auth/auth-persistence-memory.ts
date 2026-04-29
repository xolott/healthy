import { FirstOwnerAlreadyExistsError, normalizeEmail } from '@healthy/db';

import type {
  AuthPersistence,
  AuthSessionFacts,
  AuthUserFacts,
  AuthUserForOwnerLogin,
  CreateFirstOwnerUserInput,
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
function memoryHasActiveOwner(store: MemoryAuthPersistenceStore): boolean {
  for (const u of store.usersById.values()) {
    if (u.role === 'owner' && u.status === 'active' && u.deletedAt === null) {
      return true;
    }
  }
  return false;
}

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

    async hasActiveOwner() {
      return memoryHasActiveOwner(store);
    },

    async createFirstOwnerUser(input: CreateFirstOwnerUserInput) {
      if (memoryHasActiveOwner(store)) {
        throw new FirstOwnerAlreadyExistsError();
      }
      const id = `user-${store.usersById.size + 1}`;
      const email = normalizeEmail(input.email);
      const row: AuthUserFacts = {
        id,
        email,
        displayName: input.displayName,
        role: 'owner',
        status: 'active',
        deletedAt: null,
      };
      store.usersById.set(id, { ...row });
      const forLogin: AuthUserForOwnerLogin = { ...row, passwordHash: input.passwordHash };
      store.usersByEmailForLogin.set(email, { ...forLogin });
      return { ...row };
    },

    async withTransaction(fn) {
      return fn(createMemoryAuthPersistence(store));
    },
  };

  return self;
}
