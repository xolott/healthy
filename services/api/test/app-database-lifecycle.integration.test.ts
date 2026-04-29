/**
 * Issue #45: route integration proofs for production `buildApp()`, Request Scope backing
 * from `app.databaseAdapter`, observable cleanup via `app.close()`, and a clear boundary:
 * migration/seed helpers use harness `postgres` directly; HTTP paths use only the app's adapter.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { users } from '@healthy/db/schema';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { generateSessionToken } from '../src/auth/session-token.js';
import { buildApp } from '../src/app.js';
import { insertPersistedSession, insertPersistedUser } from './helpers/persisted-builders.js';
import { startApiPostgresIntegration, type ApiIntegrationHarness } from './helpers/integration-db.js';

const goodPassword = 'goodpassword12';

describe('Production database lifecycle — route integration', () => {
  describe('Testcontainers Postgres: harness migrations and seed apart from app adapter', () => {
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

    it('buildApp wires app.databaseAdapter without a startup ping; liveness before first DB-backed route', async () => {
      const app = await buildApp();
      try {
        expect(app.databaseAdapter).not.toBeNull();
        const health = await app.inject({ method: 'GET', url: '/health' });
        expect(health.statusCode).toBe(200);
        const status = await app.inject({ method: 'GET', url: '/status', headers: { accept: 'application/json' } });
        expect(status.statusCode).toBe(200);
        expect(JSON.parse(status.payload)).toMatchObject({ setupRequired: true });
      } finally {
        await app.close();
      }
    });

    it('persists seeded owner is visible only through persisted HTTP routes using the app adapter', async () => {
      await insertPersistedUser(harness.db, {
        email: 'lifecycle-owner@example.com',
        passwordHash: await hashPasswordArgon2id(goodPassword),
        displayName: 'Lifecycle Owner',
        role: 'owner',
        status: 'active',
      });

      const app = await buildApp();
      try {
        expect(app.databaseAdapter).not.toBeNull();
        expect(app.databaseAdapter!.db).not.toBe(harness.db);

        const res = await app.inject({
          method: 'GET',
          url: '/status',
          headers: { accept: 'application/json' },
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.payload)).toMatchObject({ setupRequired: false });
      } finally {
        await app.close();
      }
    });

    it('Bearer /auth/me exercises session persistence through the app-owned adapter after harness seed', async () => {
      const user = await insertPersistedUser(harness.db, {
        email: 'lifecycle-session@example.com',
        passwordHash: await hashPasswordArgon2id(goodPassword),
        displayName: 'Session Owner',
        role: 'owner',
        status: 'active',
      });
      const { rawToken, tokenHash } = generateSessionToken();
      await insertPersistedSession(harness.db, {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const app = await buildApp();
      try {
        const me = await app.inject({
          method: 'GET',
          url: '/auth/me',
          headers: { authorization: `Bearer ${rawToken}` },
        });
        expect(me.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    });
  });

  describe('Absent DATABASE_URL', () => {
    afterEach(async () => {
      vi.unstubAllEnvs();
    });

    it('buildApp succeeds; databaseAdapter stays null; liveness survives', async () => {
      vi.stubEnv('DATABASE_URL', '');
      const app = await buildApp();
      try {
        expect(app.databaseAdapter).toBeNull();

        const health = await app.inject({ method: 'GET', url: '/health' });
        expect(health.statusCode).toBe(200);

        const status = await app.inject({ method: 'GET', url: '/status' });
        expect(status.statusCode).toBe(503);
        expect(JSON.parse(status.payload)).toEqual({ error: 'service_unavailable' });
      } finally {
        await app.close();
      }
    });
  });

  describe('Unreachable DATABASE_URL', () => {
    afterEach(async () => {
      vi.unstubAllEnvs();
    });

    it('constructs adapter without connectivity probe; persistence-backed routes fail on first use', async () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://127.0.0.1:1/unreachable');
      const app = await buildApp();
      try {
        expect(app.databaseAdapter).not.toBeNull();

        const health = await app.inject({ method: 'GET', url: '/health' });
        expect(health.statusCode).toBe(200);

        const status = await app.inject({ method: 'GET', url: '/status' });
        expect(status.statusCode).toBe(503);
        expect(JSON.parse(status.payload)).toEqual({ error: 'service_unavailable' });
      } finally {
        await app.close();
      }
    });
  });
});
