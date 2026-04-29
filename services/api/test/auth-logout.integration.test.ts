import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { users } from '@healthy/db/schema';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { SESSION_COOKIE_NAME } from '../src/auth/session-token.js';
import { buildApp } from '../src/app.js';
import { insertPersistedUser } from './helpers/persisted-builders.js';
import { startApiPostgresIntegration, type ApiIntegrationHarness } from './helpers/integration-db.js';

const goodPassword = 'goodpassword12';

describe('POST /auth/logout (integration)', () => {
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

  it('returns 204 without credentials and does not error', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'POST', url: '/auth/logout' });
      expect(res.statusCode).toBe(204);
      expect(res.payload).toBe('');
    } finally {
      await app.close();
    }
  });

  it('revokes cookie session, clears Set-Cookie, and rejects cookie on /auth/me', async () => {
    await insertPersistedUser(harness.db, {
      email: 'owner2@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Owner',
      role: 'owner',
      status: 'active',
    });

    const app = await buildApp();
    try {
      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'owner2@example.com', password: goodPassword }),
      });
      expect(login.statusCode).toBe(200);
      const body = JSON.parse(login.payload) as { session: { token: string } };
      const token = body.session.token;

      const logout = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` },
      });
      expect(logout.statusCode).toBe(204);
      const clearCookie = logout.headers['set-cookie'];
      const joined = Array.isArray(clearCookie) ? clearCookie.join('\n') : (clearCookie ?? '');
      expect(joined).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(joined).toContain('Max-Age=0');

      const me = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` },
      });
      expect(me.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
