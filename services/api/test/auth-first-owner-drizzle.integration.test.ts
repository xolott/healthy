import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { users } from '@healthy/db/schema';

import { createAuthUseCasesForDatabase } from '../src/auth/auth-use-case-scope.js';
import { hashSessionTokenForLookup } from '../src/auth/session-token.js';
import {
  persistedFindSessionByTokenHash,
  persistedFindUserByEmail,
  persistedFindUserById,
  persistedHasActiveOwner,
} from './helpers/persisted-builders.js';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';

const goodPassword = 'goodpassword12';

describe('Drizzle Auth Persistence — firstOwnerSetup (integration)', () => {
  let harness: PostgresTestDatabase;

  beforeAll(async () => {
    harness = await startPostgresTestDatabase();
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

  it('persists first owner, session, and last_login_at via Auth Use Cases and Drizzle persistence', async () => {
    expect(await persistedHasActiveOwner(harness.db)).toBe(false);

    const useCases = createAuthUseCasesForDatabase(harness.db);
    const r = await useCases.firstOwnerSetup(
      'First Owner',
      'FirstOwner@Example.COM',
      goodPassword,
      { setCookie: true, ip: '127.0.0.1', userAgent: 'integration-test' },
    );

    expect(r.kind).toBe('success');
    if (r.kind !== 'success') {
      return;
    }

    const row = await persistedFindUserByEmail(harness.db, 'firstowner@example.com');
    expect(row).toBeDefined();
    expect(row!.displayName).toBe('First Owner');
    expect(row!.role).toBe('owner');
    expect(row!.status).toBe('active');

    const tokenHash = hashSessionTokenForLookup(r.rawSessionToken);
    const sess = await persistedFindSessionByTokenHash(harness.db, tokenHash);
    expect(sess).toBeDefined();
    expect(sess!.userId).toBe(row!.id);
    expect(sess!.lastUsedAt).toBeDefined();

    const userAgain = await persistedFindUserById(harness.db, row!.id);
    expect(userAgain?.lastLoginAt).toBeDefined();
  });

  it('returns setup_unavailable when first-owner setup runs again after success', async () => {
    const uc = createAuthUseCasesForDatabase(harness.db);
    const ctx = { setCookie: true, ip: '127.0.0.1', userAgent: 'integration-test' };

    const first = await uc.firstOwnerSetup('First Owner', 'second-run@example.com', goodPassword, ctx);
    expect(first.kind).toBe('success');

    const second = await uc.firstOwnerSetup('Other Owner', 'other@example.com', goodPassword, ctx);
    expect(second).toEqual({ kind: 'setup_unavailable' });
  });

  it('handles concurrent setups with identical email: one succeeds, one setup_unavailable', async () => {
    const uc = createAuthUseCasesForDatabase(harness.db);
    const ctx = { setCookie: false, ip: null, userAgent: null };
    const [a, b] = await Promise.all([
      uc.firstOwnerSetup('A', 'dup@example.com', goodPassword, ctx),
      uc.firstOwnerSetup('B', 'dup@example.com', goodPassword, ctx),
    ]);
    expect([a.kind, b.kind].sort()).toEqual(['setup_unavailable', 'success']);

    expect(await persistedFindUserByEmail(harness.db, 'dup@example.com')).toBeDefined();
  });
});
