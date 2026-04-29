import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { users } from '@healthy/db/schema';

import { createAuthUseCasesForDatabase } from '../src/auth/auth-use-case-scope.js';
import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { hashSessionTokenForLookup } from '../src/auth/session-token.js';
import {
  insertPersistedUser,
  persistedFindSessionByTokenHash,
  persistedFindUserByEmail,
  persistedFindUserById,
} from './helpers/persisted-builders.js';
import { startApiPostgresIntegration, type ApiIntegrationHarness } from './helpers/integration-db.js';

const goodPassword = 'goodpassword12';

describe('Drizzle Auth Persistence — ownerLogin (integration)', () => {
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

  it('persists session and last_login_at via Auth Use Cases and Drizzle persistence', async () => {
    const user = await insertPersistedUser(harness.db, {
      email: 'drizzle-login@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Drizzle Login',
      role: 'owner',
      status: 'active',
    });

    const useCases = createAuthUseCasesForDatabase(harness.db);
    const r = await useCases.ownerLogin('drizzle-login@example.com', goodPassword, {
      ip: '127.0.0.1',
      userAgent: 'integration-test',
    });

    expect(r.kind).toBe('success');
    if (r.kind !== 'success') {
      return;
    }

    const tokenHash = hashSessionTokenForLookup(r.rawSessionToken);
    const row = await persistedFindSessionByTokenHash(harness.db, tokenHash);
    expect(row).toBeDefined();
    expect(row!.userId).toBe(user.id);
    expect(row!.lastUsedAt).toBeDefined();

    const userAgain = await persistedFindUserById(harness.db, user.id);
    expect(userAgain?.lastLoginAt).toBeDefined();
    expect(userAgain!.lastLoginAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('owner login matches stored email after persistence canonicalization', async () => {
    await insertPersistedUser(harness.db, {
      email: 'mixed-case@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Mixed Case',
      role: 'owner',
      status: 'active',
    });

    const useCases = createAuthUseCasesForDatabase(harness.db);
    const r = await useCases.ownerLogin('  MIXED-CASE@EXAMPLE.COM ', goodPassword, {
      ip: null,
      userAgent: null,
    });

    expect(r.kind).toBe('success');
    if (r.kind !== 'success') {
      return;
    }
    expect(r.user.email).toBe('mixed-case@example.com');

    const stored = await persistedFindUserByEmail(harness.db, 'mixed-case@example.com');
    expect(stored?.lastLoginAt).toBeDefined();
  });
});
