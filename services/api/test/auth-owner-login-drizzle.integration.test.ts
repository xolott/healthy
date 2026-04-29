import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionRepository, createUserRepository } from '@healthy/db';
import { users } from '@healthy/db/schema';

import { createAuthUseCasesForDatabase } from '../src/auth/auth-use-case-scope.js';
import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { hashSessionTokenForLookup } from '../src/auth/session-token.js';
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
    const userRepo = createUserRepository(harness.db);
    const sessionRepo = createSessionRepository(harness.db);
    const user = await userRepo.createUser({
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
    const row = await sessionRepo.findSessionByTokenHash(tokenHash);
    expect(row).toBeDefined();
    expect(row!.userId).toBe(user.id);
    expect(row!.lastUsedAt).toBeDefined();

    const userAgain = await userRepo.findUserById(user.id);
    expect(userAgain?.lastLoginAt).toBeDefined();
    expect(userAgain!.lastLoginAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
