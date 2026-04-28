import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSessionRepository, createUserRepository } from '@healthy/db';
import { users } from '@healthy/db/schema';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { generateSessionToken } from '../src/auth/session-token.js';
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

  it('returns 401 for an expired session (Bearer), 200 after fresh login', async () => {
    const userRepo = createUserRepository(harness.db);
    const sessionRepo = createSessionRepository(harness.db);
    const user = await userRepo.createUser({
      email: 'owner@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Owner',
      role: 'owner',
      status: 'active',
    });

    const { rawToken, tokenHash } = generateSessionToken();
    await sessionRepo.createSession({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() - 60_000),
      lastUsedAt: new Date(),
    });

    const app = await buildApp();
    try {
      const expired = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${rawToken}` },
      });
      expect(expired.statusCode).toBe(401);
    } finally {
      await app.close();
    }

    const app2 = await buildApp();
    try {
      const login = await app2.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'owner@example.com', password: goodPassword }),
      });
      expect(login.statusCode).toBe(200);
      const body = JSON.parse(login.payload) as { session: { token: string } };
      const me = await app2.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${body.session.token}` },
      });
      expect(me.statusCode).toBe(200);
    } finally {
      await app2.close();
    }
  });

  it('returns 401 for a revoked session', async () => {
    const userRepo = createUserRepository(harness.db);
    const sessionRepo = createSessionRepository(harness.db);
    const user = await userRepo.createUser({
      email: 'owner2@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Owner',
      role: 'owner',
      status: 'active',
    });

    const { rawToken, tokenHash } = generateSessionToken();
    await sessionRepo.createSession({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(),
    });
    await sessionRepo.revokeSessionByTokenHash(tokenHash, new Date());

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${rawToken}` },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
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
        headers: { cookie: `healthy_session=${encodeURIComponent(rawToken)}` },
      });
      expect(res.statusCode).toBe(200);
      const row = await sessionRepo.findSessionByTokenHash(tokenHash);
      expect(row?.lastUsedAt).toBeDefined();
      expect(row!.lastUsedAt!.getTime()).toBeGreaterThan(t0.getTime());
    } finally {
      await app.close();
    }
  });

  it('rejects a disabled user even when a valid session row exists', async () => {
    const userRepo = createUserRepository(harness.db);
    const sessionRepo = createSessionRepository(harness.db);
    const user = await userRepo.createUser({
      email: 'owner4@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Owner',
      role: 'owner',
      status: 'active',
    });

    const { rawToken, tokenHash } = generateSessionToken();
    await sessionRepo.createSession({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(),
    });

    await harness.db
      .update(users)
      .set({ status: 'disabled', updatedAt: new Date() })
      .where(eq(users.id, user.id));

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${rawToken}` },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
