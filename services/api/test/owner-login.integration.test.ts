import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createUserRepository } from '@healthy/db';
import { users } from '@healthy/db/schema';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { buildApp } from '../src/app.js';
import { startApiPostgresIntegration, type ApiIntegrationHarness } from './helpers/integration-db.js';

const goodPassword = 'goodpassword12';

describe('POST /auth/login (integration)', () => {
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

  afterEach(async () => {
    vi.unstubAllEnvs();
  });

  it('returns 200, Set-Cookie, and a session token; Bearer and cookie satisfy /auth/me', async () => {
    const repo = createUserRepository(harness.db);
    await repo.createUser({
      email: 'owner@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Owner',
      role: 'owner',
      status: 'active',
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'owner@example.com', password: goodPassword }),
      });
      expect(res.statusCode).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(first).toMatch(/^healthy_session=/);
      expect(first).toMatch(/HttpOnly/i);

      const body = JSON.parse(res.payload) as { session: { token: string }; user: { email: string } };
      expect(body.user.email).toBe('owner@example.com');
      expect(body.session.token.length).toBeGreaterThan(20);

      const bearerMe = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${body.session.token}` },
      });
      expect(bearerMe.statusCode).toBe(200);

      const cookieMe = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie: `healthy_session=${encodeURIComponent(body.session.token)}` },
      });
      expect(cookieMe.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('returns the same neutral 401 for unknown email and wrong password', async () => {
    const repo = createUserRepository(harness.db);
    await repo.createUser({
      email: 'owner@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Owner',
      role: 'owner',
      status: 'active',
    });

    const app = await buildApp();
    try {
      const unknown = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'nope@example.com', password: goodPassword }),
      });
      expect(unknown.statusCode).toBe(401);
      const wrongPw = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'owner@example.com', password: 'wrongpassword1' }),
      });
      expect(wrongPw.statusCode).toBe(401);
      expect(JSON.parse(unknown.payload)).toEqual(JSON.parse(wrongPw.payload));
    } finally {
      await app.close();
    }
  });

  it('returns 401 for disabled, soft-deleted, or non-owner accounts', async () => {
    const repo = createUserRepository(harness.db);
    await repo.createUser({
      email: 'disabled@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'D',
      role: 'owner',
      status: 'disabled',
    });
    await repo.createUser({
      email: 'member@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'M',
      role: 'member',
      status: 'active',
    });
    const deleted = await repo.createUser({
      email: 'deleted@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'X',
      role: 'owner',
      status: 'active',
    });
    await harness.db
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, deleted.id));

    const app = await buildApp();
    try {
      for (const email of ['disabled@example.com', 'member@example.com', 'deleted@example.com']) {
        const r = await app.inject({
          method: 'POST',
          url: '/auth/login',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ email, password: goodPassword }),
        });
        expect(r.statusCode).toBe(401);
        expect(JSON.parse(r.payload)).toEqual({ error: 'invalid_credentials' });
      }
    } finally {
      await app.close();
    }
  });

  it('returns 400 invalid_input for an empty email after trim', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: '   ', password: goodPassword }),
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload) as { error: string; field: string };
      expect(body.error).toBe('invalid_input');
      expect(body.field).toBe('email');
    } finally {
      await app.close();
    }
  });
});
