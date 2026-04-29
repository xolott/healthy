import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionRepository, createUserRepository } from '@healthy/db';
import { users } from '@healthy/db/schema';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { generateSessionToken } from '../src/auth/session-token.js';
import { createAuthUseCasesForDatabase } from '../src/auth/auth-me-from-request.js';
import { startApiPostgresIntegration, type ApiIntegrationHarness } from './helpers/integration-db.js';

const goodPassword = 'goodpassword12';

describe('Drizzle Auth Persistence — resolveCurrentSession (integration)', () => {
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
    const userRepo = createUserRepository(harness.db);
    const sessionRepo = createSessionRepository(harness.db);
    const user = await userRepo.createUser({
      email: 'drizzle-me@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Drizzle',
      role: 'owner',
      status: 'active',
    });

    const { rawToken, tokenHash } = generateSessionToken();
    const t0 = new Date(Date.now() - 3_600_000);
    await sessionRepo.createSession({
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

    const row = await sessionRepo.findSessionByTokenHash(tokenHash);
    expect(row?.lastUsedAt).toBeDefined();
    expect(row!.lastUsedAt!.getTime()).toBeGreaterThan(t0.getTime());
  });
});
