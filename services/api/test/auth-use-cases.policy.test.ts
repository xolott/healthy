import { describe, expect, it } from 'vitest';

import {
  createMemoryAuthPersistence,
  createMemoryAuthPersistenceStore,
} from '../src/auth/auth-persistence-memory.js';
import { hashSessionTokenForLookup } from '../src/auth/session-token.js';
import { createAuthUseCases } from '../src/auth/auth-use-cases.js';

const fixedNow = new Date('2026-04-01T12:00:00.000Z');
const userId = 'user-1';
const rawToken = 'test-raw-token-for-policy';
const tokenHash = hashSessionTokenForLookup(rawToken);

const baseUser = {
  id: userId,
  email: 'u@example.com',
  displayName: 'U',
  role: 'owner' as const,
  status: 'active' as const,
  deletedAt: null as Date | null,
};

function useCases(store = createMemoryAuthPersistenceStore()) {
  const persistence = createMemoryAuthPersistence(store);
  return { useCases: createAuthUseCases({ persistence, clock: () => fixedNow }), store };
}

describe('Auth Use Cases — resolveCurrentSession (policy, in-memory persistence)', () => {
  it('returns ok for an active session and active user; updates last_used_at', async () => {
    const { store, useCases: uc } = useCases();
    store.sessionsByTokenHash.set(tokenHash, {
      userId,
      revokedAt: null,
      expiresAt: new Date(fixedNow.getTime() + 60_000),
      lastUsedAt: new Date(fixedNow.getTime() - 60_000),
    });
    store.usersById.set(userId, baseUser);

    const r = await uc.resolveCurrentSession(rawToken);
    expect(r).toEqual({
      kind: 'ok',
      user: { id: userId, email: baseUser.email, displayName: baseUser.displayName, role: 'owner' },
    });
    expect(store.sessionsByTokenHash.get(tokenHash)?.lastUsedAt?.getTime()).toBe(fixedNow.getTime());
  });

  it('returns unauthorized missing_session when no row', async () => {
    const { useCases: uc } = useCases();
    const r = await uc.resolveCurrentSession(rawToken);
    expect(r).toEqual({ kind: 'unauthorized', reason: 'missing_session' });
  });

  it('returns unauthorized revoked when revokedAt is set', async () => {
    const { store, useCases: uc } = useCases();
    store.sessionsByTokenHash.set(tokenHash, {
      userId,
      revokedAt: new Date(fixedNow.getTime() - 1000),
      expiresAt: new Date(fixedNow.getTime() + 60_000),
      lastUsedAt: null,
    });
    store.usersById.set(userId, baseUser);
    expect(await uc.resolveCurrentSession(rawToken)).toEqual({ kind: 'unauthorized', reason: 'revoked' });
  });

  it('returns unauthorized expired when expiresAt is not after now', async () => {
    const { store, useCases: uc } = useCases();
    store.sessionsByTokenHash.set(tokenHash, {
      userId,
      revokedAt: null,
      expiresAt: new Date(fixedNow.getTime() - 1),
      lastUsedAt: null,
    });
    store.usersById.set(userId, baseUser);
    expect(await uc.resolveCurrentSession(rawToken)).toEqual({ kind: 'unauthorized', reason: 'expired' });
  });

  it('returns unauthorized user_missing when user row is absent', async () => {
    const { store, useCases: uc } = useCases();
    store.sessionsByTokenHash.set(tokenHash, {
      userId,
      revokedAt: null,
      expiresAt: new Date(fixedNow.getTime() + 60_000),
      lastUsedAt: null,
    });
    expect(await uc.resolveCurrentSession(rawToken)).toEqual({ kind: 'unauthorized', reason: 'user_missing' });
  });

  it('returns unauthorized user_ineligible when user is disabled', async () => {
    const { store, useCases: uc } = useCases();
    store.sessionsByTokenHash.set(tokenHash, {
      userId,
      revokedAt: null,
      expiresAt: new Date(fixedNow.getTime() + 60_000),
      lastUsedAt: null,
    });
    store.usersById.set(userId, { ...baseUser, status: 'disabled' });
    expect(await uc.resolveCurrentSession(rawToken)).toEqual({ kind: 'unauthorized', reason: 'user_ineligible' });
  });

  it('returns unauthorized user_ineligible when user is soft-deleted', async () => {
    const { store, useCases: uc } = useCases();
    store.sessionsByTokenHash.set(tokenHash, {
      userId,
      revokedAt: null,
      expiresAt: new Date(fixedNow.getTime() + 60_000),
      lastUsedAt: null,
    });
    store.usersById.set(userId, { ...baseUser, deletedAt: new Date('2025-01-01T00:00:00.000Z') });
    expect(await uc.resolveCurrentSession(rawToken)).toEqual({ kind: 'unauthorized', reason: 'user_ineligible' });
  });
});
