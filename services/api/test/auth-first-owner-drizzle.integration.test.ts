import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionRepository, createUserRepository } from '@healthy/db';
import { users } from '@healthy/db/schema';

import { createAuthUseCasesForDatabase } from '../src/auth/auth-use-case-scope.js';
import { hashSessionTokenForLookup } from '../src/auth/session-token.js';
import { startApiPostgresIntegration, type ApiIntegrationHarness } from './helpers/integration-db.js';

const goodPassword = 'goodpassword12';

describe('Drizzle Auth Persistence — firstOwnerSetup (integration)', () => {
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

  it('persists first owner, session, and last_login_at via Auth Use Cases and Drizzle persistence', async () => {
    const userRepo = createUserRepository(harness.db);
    const sessionRepo = createSessionRepository(harness.db);

    expect(await userRepo.hasActiveOwner()).toBe(false);

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

    const row = await userRepo.findUserByEmail('firstowner@example.com');
    expect(row).toBeDefined();
    expect(row!.displayName).toBe('First Owner');
    expect(row!.role).toBe('owner');
    expect(row!.status).toBe('active');

    const tokenHash = hashSessionTokenForLookup(r.rawSessionToken);
    const sess = await sessionRepo.findSessionByTokenHash(tokenHash);
    expect(sess).toBeDefined();
    expect(sess!.userId).toBe(row!.id);
    expect(sess!.lastUsedAt).toBeDefined();

    const userAgain = await userRepo.findUserById(row!.id);
    expect(userAgain?.lastLoginAt).toBeDefined();
  });
});
