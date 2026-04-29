import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { createSessionRepository, createUserRepository } from '@healthy/db';
import { users } from '@healthy/db/schema';

import { registerEnv } from '../src/config/env.js';
import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { generateSessionToken } from '../src/auth/session-token.js';
import { createRequestScopeForApp } from '../src/request-scope/index.js';
import { startApiPostgresIntegration, type ApiIntegrationHarness } from './helpers/integration-db.js';

const goodPassword = 'goodpassword12';

/**
 * Proves the Fastify-backed Request Scope adapter (`createRequestScopeForApp`) works end-to-end
 * against real PostgreSQL: callers use only capability methods — no database handles on the scope.
 *
 * Lower-level Drizzle auth persistence tests continue to use `createAuthUseCasesForDatabase(db)` directly.
 */
describe('Request Scope — PostgreSQL-backed adapter (integration)', () => {
  let harness: ApiIntegrationHarness;
  let app: FastifyInstance | undefined;

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
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('status.activeOwnerExists reflects persisted owners via Request Scope only', async () => {
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);

    await expect(scope.status.activeOwnerExists()).resolves.toEqual({
      kind: 'ok',
      hasActiveOwner: false,
    });

    const userRepo = createUserRepository(harness.db);
    await userRepo.createUser({
      email: 'scope-status@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Scope Status',
      role: 'owner',
      status: 'active',
    });

    await expect(scope.status.activeOwnerExists()).resolves.toEqual({
      kind: 'ok',
      hasActiveOwner: true,
    });
  });

  it('currentSession.resolveFromRawToken resolves a session via Request Scope only', async () => {
    const userRepo = createUserRepository(harness.db);
    const sessionRepo = createSessionRepository(harness.db);
    const user = await userRepo.createUser({
      email: 'scope-session@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Scope Session',
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

    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);

    const r = await scope.currentSession.resolveFromRawToken(rawToken);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.user).toMatchObject({
      id: user.id,
      email: 'scope-session@example.com',
      displayName: 'Scope Session',
      role: 'owner',
    });

    const row = await sessionRepo.findSessionByTokenHash(tokenHash);
    expect(row?.lastUsedAt).toBeDefined();
    expect(row!.lastUsedAt!.getTime()).toBeGreaterThan(t0.getTime());
  });
});
