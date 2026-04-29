import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { eq } from 'drizzle-orm';

import { sessions, users } from '@healthy/db/schema';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { generateSessionToken } from '../src/auth/session-token.js';
import { createAuthUseCasesForDatabase } from '../src/auth/auth-use-case-scope.js';
import {
  insertPersistedSession,
  insertPersistedUser,
  persistedFindSessionByTokenHash,
} from './helpers/persisted-builders.js';
import { startApiPostgresIntegration, type ApiIntegrationHarness } from './helpers/integration-db.js';

const goodPassword = 'goodpassword12';

describe('Drizzle Auth Persistence — Auth Use Cases (integration)', () => {
  let harness: ApiIntegrationHarness;

  beforeAll(async () => {
    harness = await startApiPostgresIntegration();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  beforeEach(async () => {
    await harness.db.delete(users);
    vi.stubEnv('DATABASE_URL', harness.connectionUri);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves the current user via factory use cases and Drizzle-backed persistence', async () => {
    const user = await insertPersistedUser(harness.db, {
      email: 'drizzle-me@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Drizzle',
      role: 'owner',
      status: 'active',
    });

    const { rawToken, tokenHash } = generateSessionToken();
    const t0 = new Date(Date.now() - 3_600_000);
    await insertPersistedSession(harness.db, {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastUsedAt: t0,
    });

    const useCases = createAuthUseCasesForDatabase(harness.db);
    const r = await useCases.resolveCurrentSession(rawToken);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.user).toMatchObject({
      id: user.id,
      email: 'drizzle-me@example.com',
      displayName: 'Drizzle',
      role: 'owner',
    });

    const row = await persistedFindSessionByTokenHash(harness.db, tokenHash);
    expect(row?.lastUsedAt).toBeDefined();
    expect(row!.lastUsedAt!.getTime()).toBeGreaterThan(t0.getTime());
  });

  it('revokes session via factory logout against Drizzle-backed persistence', async () => {
    const user = await insertPersistedUser(harness.db, {
      email: 'drizzle-logout@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Logout',
      role: 'owner',
      status: 'active',
    });

    const { rawToken, tokenHash } = generateSessionToken();
    await insertPersistedSession(harness.db, {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(Date.now() - 60_000),
    });

    const useCases = createAuthUseCasesForDatabase(harness.db);
    expect(await useCases.logout(rawToken)).toEqual({ kind: 'session_revoked' });

    const row = await persistedFindSessionByTokenHash(harness.db, tokenHash);
    expect(row?.revokedAt).toBeDefined();

    expect((await useCases.logout(rawToken)).kind).toBe('noop');
  });

  describe('resolveCurrentSession — unauthorized outcomes', () => {
    it('returns missing_session when no sessions row matches the token hash', async () => {
      const missing = generateSessionToken();
      await expect(
        createAuthUseCasesForDatabase(harness.db).resolveCurrentSession(missing.rawToken),
      ).resolves.toEqual({ kind: 'unauthorized', reason: 'missing_session' });
    });

    it('returns revoked without touching last_used_at when session is revoked', async () => {
      const user = await insertPersistedUser(harness.db, {
        email: 'sess-revoked@example.com',
        passwordHash: await hashPasswordArgon2id(goodPassword),
        displayName: 'R',
        role: 'owner',
        status: 'active',
      });
      const { rawToken, tokenHash } = generateSessionToken();
      const t0 = new Date(Date.now() - 4_800_000);
      await insertPersistedSession(harness.db, {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastUsedAt: t0,
      });
      await harness.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, tokenHash));

      const uc = createAuthUseCasesForDatabase(harness.db);
      await expect(uc.resolveCurrentSession(rawToken)).resolves.toEqual({
        kind: 'unauthorized',
        reason: 'revoked',
      });

      const row = await persistedFindSessionByTokenHash(harness.db, tokenHash);
      expect(row?.lastUsedAt?.getTime()).toBe(t0.getTime());
    });

    it('returns expired without touching last_used_at', async () => {
      const user = await insertPersistedUser(harness.db, {
        email: 'sess-expired@example.com',
        passwordHash: await hashPasswordArgon2id(goodPassword),
        displayName: 'E',
        role: 'owner',
        status: 'active',
      });
      const { rawToken, tokenHash } = generateSessionToken();
      const t0 = new Date(Date.now() - 86_400_000);
      await insertPersistedSession(harness.db, {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() - 60_000),
        lastUsedAt: t0,
      });

      const uc = createAuthUseCasesForDatabase(harness.db);
      await expect(uc.resolveCurrentSession(rawToken)).resolves.toEqual({
        kind: 'unauthorized',
        reason: 'expired',
      });

      const row = await persistedFindSessionByTokenHash(harness.db, tokenHash);
      expect(row?.lastUsedAt?.getTime()).toBe(t0.getTime());
    });

    it('returns user_ineligible when owner account is disabled', async () => {
      const user = await insertPersistedUser(harness.db, {
        email: 'inactive@example.com',
        passwordHash: await hashPasswordArgon2id(goodPassword),
        displayName: 'Off',
        role: 'owner',
        status: 'disabled',
      });
      const { rawToken, tokenHash } = generateSessionToken();
      await insertPersistedSession(harness.db, {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastUsedAt: null,
      });

      const uc = createAuthUseCasesForDatabase(harness.db);
      await expect(uc.resolveCurrentSession(rawToken)).resolves.toEqual({
        kind: 'unauthorized',
        reason: 'user_ineligible',
      });
    });

    it('returns user_ineligible when user is soft-deleted', async () => {
      const user = await insertPersistedUser(harness.db, {
        email: 'gone@example.com',
        passwordHash: await hashPasswordArgon2id(goodPassword),
        displayName: 'G',
        role: 'owner',
        status: 'active',
      });
      const { rawToken, tokenHash } = generateSessionToken();
      await insertPersistedSession(harness.db, {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastUsedAt: null,
      });
      await harness.db
        .update(users)
        .set({ deletedAt: new Date(Date.now() - 3_600_000) })
        .where(eq(users.id, user.id));

      const uc = createAuthUseCasesForDatabase(harness.db);
      await expect(uc.resolveCurrentSession(rawToken)).resolves.toEqual({
        kind: 'unauthorized',
        reason: 'user_ineligible',
      });
    });
  });
});
