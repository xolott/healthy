import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionRepository, createUserRepository } from '@healthy/db';
import { users } from '@healthy/db/schema';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { generateSessionToken, SESSION_COOKIE_NAME } from '../src/auth/session-token.js';
import { buildApp } from '../src/app.js';
import { startApiPostgresIntegration, type ApiIntegrationHarness } from './helpers/integration-db.js';

const goodPassword = 'goodpassword12';

describe('GET /auth/me (integration)', () => {
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

  it('accepts the HttpOnly session cookie and updates last_used_at on success', async () => {
    const userRepo = createUserRepository(harness.db);
    const sessionRepo = createSessionRepository(harness.db);
    const user = await userRepo.createUser({
      email: 'owner3@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Owner',
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

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}` },
      });
      expect(res.statusCode).toBe(200);
      const row = await sessionRepo.findSessionByTokenHash(tokenHash);
      expect(row?.lastUsedAt).toBeDefined();
      expect(row!.lastUsedAt!.getTime()).toBeGreaterThan(t0.getTime());
    } finally {
      await app.close();
    }
  });
});
