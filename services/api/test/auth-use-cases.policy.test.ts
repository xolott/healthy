import { describe, expect, it } from 'vitest';

import {
  createMemoryAuthPersistence,
  createMemoryAuthPersistenceStore,
} from '../src/auth/auth-persistence-memory.js';
import { canonicalizeAuthEmailForPersistence, type AuthUserForOwnerLogin } from '../src/auth/auth-persistence.js';
import { createAuthUseCases } from '../src/auth/auth-use-cases.js';
import { MIN_PASSWORD_LENGTH } from '../src/auth/password-policy.js';
import { hashSessionTokenForLookup } from '../src/auth/session-token.js';

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
  return {
    useCases: createAuthUseCases({
      persistence,
      clock: () => fixedNow,
      verifyPassword: async () => false,
      generateSessionToken: () => ({ rawToken: 'unused', tokenHash: 'unused' }),
      hashPassword: async (plain) => `hashed:${plain}`,
    }),
    store,
  };
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

const loginRawToken = 'policy-owner-login-token______________';
const loginTokenHash = hashSessionTokenForLookup(loginRawToken);
const goodLoginPassword = 'goodpassword12';
const storedLoginHashFixture = 'stored-hash';

const sessionExpiresAfterLogin = new Date(fixedNow.getTime() + 30 * 24 * 60 * 60 * 1000);

function seedActiveOwnerForLogin(
  store: ReturnType<typeof createMemoryAuthPersistenceStore>,
  overrides: Partial<AuthUserForOwnerLogin> = {},
): void {
  const row: AuthUserForOwnerLogin = {
    id: userId,
    email: 'owner@example.com',
    displayName: 'Owner',
    role: 'owner',
    status: 'active',
    deletedAt: null,
    passwordHash: storedLoginHashFixture,
    ...overrides,
  };
  store.usersByEmailForLogin.set(canonicalizeAuthEmailForPersistence(row.email), row);
}

function ownerLoginUseCases(
  store: ReturnType<typeof createMemoryAuthPersistenceStore>,
  verifyPassword: (plain: string, storedHash: string) => Promise<boolean> = async (plain, hash) =>
    plain === goodLoginPassword && hash === storedLoginHashFixture,
) {
  const persistence = createMemoryAuthPersistence(store);
  return createAuthUseCases({
    persistence,
    clock: () => fixedNow,
    verifyPassword,
    generateSessionToken: () => ({ rawToken: loginRawToken, tokenHash: loginTokenHash }),
    hashPassword: async (plain) => `hashed:${plain}`,
  });
}

describe('Auth Use Cases — ownerLogin (policy, in-memory persistence)', () => {
  const ctx = { ip: '127.0.0.1', userAgent: 'vitest' };

  it('returns invalid_input for empty email after trim', async () => {
    const store = createMemoryAuthPersistenceStore();
    const uc = ownerLoginUseCases(store);
    expect(await uc.ownerLogin('   ', goodLoginPassword, ctx)).toEqual({
      kind: 'invalid_input',
      field: 'email',
      message: 'Email is required',
    });
  });

  it('returns invalid_input when email has no @', async () => {
    const store = createMemoryAuthPersistenceStore();
    const uc = ownerLoginUseCases(store);
    expect(await uc.ownerLogin('not-an-email', goodLoginPassword, ctx)).toEqual({
      kind: 'invalid_input',
      field: 'email',
      message: 'Email is invalid',
    });
  });

  it('returns invalid_input for password policy failures', async () => {
    const store = createMemoryAuthPersistenceStore();
    seedActiveOwnerForLogin(store);
    const uc = ownerLoginUseCases(store);
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
    const r = await uc.ownerLogin('owner@example.com', short, ctx);
    expect(r.kind).toBe('invalid_input');
    if (r.kind !== 'invalid_input') {
      return;
    }
    expect(r.field).toBe('password');
    expect(r.message).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('returns invalid_credentials for unknown email (neutral)', async () => {
    const store = createMemoryAuthPersistenceStore();
    const uc = ownerLoginUseCases(store);
    expect(await uc.ownerLogin('missing@example.com', goodLoginPassword, ctx)).toEqual({
      kind: 'invalid_credentials',
    });
  });

  it('returns invalid_credentials for wrong password (neutral)', async () => {
    const store = createMemoryAuthPersistenceStore();
    seedActiveOwnerForLogin(store);
    const uc = ownerLoginUseCases(store, async () => false);
    expect(await uc.ownerLogin('owner@example.com', goodLoginPassword, ctx)).toEqual({
      kind: 'invalid_credentials',
    });
  });

  it('invalid_credentials shapes match for unknown email and wrong password', async () => {
    const store = createMemoryAuthPersistenceStore();
    seedActiveOwnerForLogin(store);
    const unknown = await ownerLoginUseCases(store).ownerLogin('nope@example.com', goodLoginPassword, ctx);
    const wrongPw = await ownerLoginUseCases(store, async () => false).ownerLogin(
      'owner@example.com',
      goodLoginPassword,
      ctx,
    );
    expect(unknown).toEqual(wrongPw);
  });

  it('returns invalid_credentials for disabled, non-owner, or soft-deleted owners', async () => {
    const cases: Partial<AuthUserForOwnerLogin>[] = [
      { status: 'disabled' },
      { role: 'member' },
      { deletedAt: new Date('2025-01-01T00:00:00.000Z') },
    ];
    for (const patch of cases) {
      const store = createMemoryAuthPersistenceStore();
      seedActiveOwnerForLogin(store, patch);
      const uc = ownerLoginUseCases(store);
      expect(await uc.ownerLogin('owner@example.com', goodLoginPassword, ctx)).toEqual({
        kind: 'invalid_credentials',
      });
    }
  });

  it('resolves owner by email using persistence canonicalization (case / outer whitespace)', async () => {
    const store = createMemoryAuthPersistenceStore();
    seedActiveOwnerForLogin(store);
    const uc = ownerLoginUseCases(store);
    const r = await uc.ownerLogin('  OWNER@EXAMPLE.COM ', goodLoginPassword, ctx);
    expect(r.kind).toBe('success');
    if (r.kind !== 'success') {
      return;
    }
    expect(r.user.email).toBe('owner@example.com');
  });

  it('creates session and last-login with deterministic token and clock on success', async () => {
    const store = createMemoryAuthPersistenceStore();
    seedActiveOwnerForLogin(store);
    const uc = ownerLoginUseCases(store);
    const r = await uc.ownerLogin('owner@example.com', goodLoginPassword, ctx);
    expect(r).toEqual({
      kind: 'success',
      user: {
        id: userId,
        email: 'owner@example.com',
        displayName: 'Owner',
        role: 'owner',
      },
      rawSessionToken: loginRawToken,
      sessionExpiresAt: sessionExpiresAfterLogin,
    });
    expect(store.sessionsByTokenHash.get(loginTokenHash)).toEqual({
      userId,
      revokedAt: null,
      expiresAt: sessionExpiresAfterLogin,
      lastUsedAt: fixedNow,
    });
    expect(store.lastLoginAtByUserId.get(userId)?.getTime()).toBe(fixedNow.getTime());
  });
});

const setupRawToken = 'policy-first-owner-token____________';
const setupTokenHash = hashSessionTokenForLookup(setupRawToken);
const goodSetupPassword = 'goodpassword12';
const sessionExpiresAfterSetup = new Date(fixedNow.getTime() + 30 * 24 * 60 * 60 * 1000);
const setupCtx = { setCookie: true, ip: '127.0.0.1', userAgent: 'vitest-setup' };

function firstOwnerPolicyUseCases(store: ReturnType<typeof createMemoryAuthPersistenceStore>) {
  const persistence = createMemoryAuthPersistence(store);
  return createAuthUseCases({
    persistence,
    clock: () => fixedNow,
    verifyPassword: async () => false,
    generateSessionToken: () => ({ rawToken: setupRawToken, tokenHash: setupTokenHash }),
    hashPassword: async (plain) => `argon:${plain}`,
  });
}

describe('Auth Use Cases — firstOwnerSetup (policy, in-memory persistence)', () => {
  it('returns invalid_input for empty display name after trim', async () => {
    const store = createMemoryAuthPersistenceStore();
    const uc = firstOwnerPolicyUseCases(store);
    expect(await uc.firstOwnerSetup('  ', 'a@b.co', goodSetupPassword, setupCtx)).toEqual({
      kind: 'invalid_input',
      field: 'displayName',
      message: 'Display name is required',
    });
  });

  it('returns invalid_input when display name exceeds max length', async () => {
    const store = createMemoryAuthPersistenceStore();
    const uc = firstOwnerPolicyUseCases(store);
    const longName = 'x'.repeat(201);
    expect(await uc.firstOwnerSetup(longName, 'a@b.co', goodSetupPassword, setupCtx)).toEqual({
      kind: 'invalid_input',
      field: 'displayName',
      message: 'Display name is too long',
    });
  });

  it('returns invalid_input for email after trim', async () => {
    const store = createMemoryAuthPersistenceStore();
    const uc = firstOwnerPolicyUseCases(store);
    expect(await uc.firstOwnerSetup('N', '  ', goodSetupPassword, setupCtx)).toEqual({
      kind: 'invalid_input',
      field: 'email',
      message: 'Email is required',
    });
    expect(await uc.firstOwnerSetup('N', 'x', goodSetupPassword, setupCtx)).toEqual({
      kind: 'invalid_input',
      field: 'email',
      message: 'Email is invalid',
    });
  });

  it('returns password_policy for short password', async () => {
    const store = createMemoryAuthPersistenceStore();
    const uc = firstOwnerPolicyUseCases(store);
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
    const r = await uc.firstOwnerSetup('Owner', 'o@example.com', short, setupCtx);
    expect(r.kind).toBe('password_policy');
    if (r.kind !== 'password_policy') {
      return;
    }
    expect(r.minLength).toBe(MIN_PASSWORD_LENGTH);
    expect(r.message).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('returns setup_unavailable when an active owner already exists', async () => {
    const store = createMemoryAuthPersistenceStore();
    seedActiveOwnerForLogin(store);
    store.usersById.set(userId, {
      id: userId,
      email: 'owner@example.com',
      displayName: 'Owner',
      role: 'owner',
      status: 'active',
      deletedAt: null,
    });
    const uc = firstOwnerPolicyUseCases(store);
    expect(await uc.firstOwnerSetup('N', 'other@example.com', goodSetupPassword, setupCtx)).toEqual({
      kind: 'setup_unavailable',
    });
  });

  it('creates owner, session, and last-login with deterministic token and clock on success', async () => {
    const store = createMemoryAuthPersistenceStore();
    const uc = firstOwnerPolicyUseCases(store);
    const r = await uc.firstOwnerSetup('First', 'first@example.com', goodSetupPassword, setupCtx);
    expect(r).toEqual({
      kind: 'success',
      user: {
        id: 'user-1',
        email: 'first@example.com',
        displayName: 'First',
        role: 'owner',
      },
      rawSessionToken: setupRawToken,
      sessionExpiresAt: sessionExpiresAfterSetup,
      setCookie: true,
    });
    expect(store.sessionsByTokenHash.get(setupTokenHash)).toEqual({
      userId: 'user-1',
      revokedAt: null,
      expiresAt: sessionExpiresAfterSetup,
      lastUsedAt: fixedNow,
    });
    expect(store.lastLoginAtByUserId.get('user-1')?.getTime()).toBe(fixedNow.getTime());
  });
});

describe('Auth Use Cases — logout (policy, in-memory persistence)', () => {
  const logoutRawToken = 'policy-logout-token___________________';
  const logoutTokenHash = hashSessionTokenForLookup(logoutRawToken);

  it('returns skipped no_raw_token when token is undefined', async () => {
    const { useCases: uc } = useCases();
    expect(await uc.logout(undefined)).toEqual({ kind: 'skipped', reason: 'no_raw_token' });
  });

  it('returns skipped no_raw_token when token is empty string', async () => {
    const { useCases: uc } = useCases();
    expect(await uc.logout('')).toEqual({ kind: 'skipped', reason: 'no_raw_token' });
  });

  it('revokes using deterministic SHA-256 hash of raw token', async () => {
    const { store, useCases: uc } = useCases();
    store.sessionsByTokenHash.set(logoutTokenHash, {
      userId,
      revokedAt: null,
      expiresAt: new Date(fixedNow.getTime() + 60_000),
      lastUsedAt: fixedNow,
    });
    store.usersById.set(userId, baseUser);

    expect(await uc.logout(logoutRawToken)).toEqual({ kind: 'session_revoked' });
    expect(store.sessionsByTokenHash.get(logoutTokenHash)?.revokedAt?.getTime()).toBe(fixedNow.getTime());
  });

  it('returns noop when no session exists for hash', async () => {
    const { useCases: uc } = useCases();
    expect(await uc.logout(logoutRawToken)).toEqual({
      kind: 'noop',
      reason: 'session_not_found_or_already_revoked',
    });
  });

  it('returns noop when session already revoked', async () => {
    const { store, useCases: uc } = useCases();
    store.sessionsByTokenHash.set(logoutTokenHash, {
      userId,
      revokedAt: new Date(fixedNow.getTime() - 1000),
      expiresAt: new Date(fixedNow.getTime() + 60_000),
      lastUsedAt: null,
    });

    expect(await uc.logout(logoutRawToken)).toEqual({
      kind: 'noop',
      reason: 'session_not_found_or_already_revoked',
    });
  });
});
