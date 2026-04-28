import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createUserRepository } from '@healthy/db';
import { users } from '@healthy/db/schema';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { buildApp } from '../src/app.js';
import { startApiPostgresIntegration, type ApiIntegrationHarness } from './helpers/integration-db.js';

const goodPassword = 'goodpassword12';

/**
 * Single integration trace for issue #16: fresh DB onboarding through logout,
 * plus a second trace for an already-initialized server (login-only path).
 */
describe('Auth lifecycle (integration contract)', () => {
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

  it('fresh server: status → first-owner → status → me → logout → me unauthorized', async () => {
    const app = await buildApp();
    try {
      const statusBefore = await app.inject({
        method: 'GET',
        url: '/status',
        headers: { accept: 'application/json' },
      });
      expect(statusBefore.statusCode).toBe(200);
      expect(JSON.parse(statusBefore.payload)).toMatchObject({ setupRequired: true });

      const setup = await app.inject({
        method: 'POST',
        url: '/setup/first-owner',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          displayName: 'First',
          email: 'first@example.com',
          password: goodPassword,
        }),
      });
      expect(setup.statusCode).toBe(201);
      const created = JSON.parse(setup.payload) as { session: { token: string }; user: { email: string } };
      expect(created.user.email).toBe('first@example.com');
      const token = created.session.token;

      const statusAfter = await app.inject({
        method: 'GET',
        url: '/status',
        headers: { accept: 'application/json' },
      });
      expect(statusAfter.statusCode).toBe(200);
      expect(JSON.parse(statusAfter.payload)).toMatchObject({ setupRequired: false });

      const me = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(me.statusCode).toBe(200);

      const logout = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(logout.statusCode).toBe(204);

      const meAfter = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(meAfter.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('initialized server: login → me → logout matches onboarding client contracts', async () => {
    const repo = createUserRepository(harness.db);
    await repo.createUser({
      email: 'existing@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Existing',
      role: 'owner',
      status: 'active',
    });

    const app = await buildApp();
    try {
      const status = await app.inject({
        method: 'GET',
        url: '/status',
        headers: { accept: 'application/json' },
      });
      expect(status.statusCode).toBe(200);
      expect(JSON.parse(status.payload)).toMatchObject({ setupRequired: false });

      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'existing@example.com', password: goodPassword }),
      });
      expect(login.statusCode).toBe(200);
      const body = JSON.parse(login.payload) as { session: { token: string } };
      const token = body.session.token;

      const me = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(me.statusCode).toBe(200);

      expect(
        (await app.inject({ method: 'POST', url: '/auth/logout', headers: { authorization: `Bearer ${token}` } }))
          .statusCode,
      ).toBe(204);

      expect(
        (await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${token}` } }))
          .statusCode,
      ).toBe(401);
    } finally {
      await app.close();
    }
  });
});
