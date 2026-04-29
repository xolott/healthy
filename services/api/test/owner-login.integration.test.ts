import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { users } from '@healthy/db/schema';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { SESSION_COOKIE_NAME } from '../src/auth/session-token.js';
import { buildApp } from '../src/app.js';
import { insertPersistedUser } from './helpers/persisted-builders.js';
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
    await insertPersistedUser(harness.db, {
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
        headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(body.session.token)}` },
      });
      expect(cookieMe.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
