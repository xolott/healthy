import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { registerEnv } from '../src/config/env.js';
import { getSessionTokenFromRequest } from '../src/auth/parse-bearer-cookie.js';
import { SESSION_COOKIE_NAME } from '../src/auth/session-token.js';
import { createRequestScopeForApp, type RequestScope } from '../src/request-scope/index.js';

describe('Request Scope (public status / setup required)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('reports persistence_not_configured when DATABASE_URL is missing', async () => {
    vi.stubEnv('DATABASE_URL', '');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    await expect(scope.status.isFirstOwnerSetupRequired()).resolves.toEqual({ kind: 'persistence_not_configured' });
  });

  it('reports persistence_not_configured when DATABASE_URL is only whitespace', async () => {
    vi.stubEnv('DATABASE_URL', '   \t  ');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    await expect(scope.status.isFirstOwnerSetupRequired()).resolves.toEqual({ kind: 'persistence_not_configured' });
  });

  it('allows a fake RequestScope for status capability wiring in route tests', async () => {
    const fake: RequestScope = {
      status: {
        async isFirstOwnerSetupRequired() {
          return { kind: 'ok', isFirstOwnerSetupRequired: false };
        },
      },
      currentSession: {
        async resolveFromRawToken() {
          return { kind: 'unauthorized', reason: 'missing_session' };
        },
      },
      logout: {
        async logoutWithRawToken() {
          return { kind: 'skipped', reason: 'no_raw_token' };
        },
      },
      ownerLogin: {
        async loginWithEmailPassword() {
          return { kind: 'invalid_credentials' };
        },
      },
      firstOwnerSetup: {
        async setupFirstOwner() {
          return { kind: 'setup_unavailable' };
        },
      },
      pantry: {
        async listItemsForOwner() {
          return { kind: 'ok', items: [] };
        },
        async getItemForOwner() {
          return { kind: 'not_found' };
        },
        async getReferenceCatalog() {
          return { kind: 'ok', nutrients: [], iconKeys: [] };
        },
      },
    };
    await expect(fake.status.isFirstOwnerSetupRequired()).resolves.toEqual({
      kind: 'ok',
      isFirstOwnerSetupRequired: false,
    });
  });

  it('reports persistence_unavailable when the database connection fails', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://127.0.0.1:1/unreachable_for_status_scope_test');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    const outcome = await scope.status.isFirstOwnerSetupRequired();
    expect(outcome.kind).toBe('persistence_unavailable');
  });

  it('reuses the same Database Adapter for multiple persistence-backed capability calls', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://127.0.0.1:1/adapter_singleton_scope_test');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const adapterSingleton = app.databaseAdapter;
    expect(adapterSingleton).not.toBeNull();
    const scope = createRequestScopeForApp(app);
    await scope.status.isFirstOwnerSetupRequired();
    await scope.logout.logoutWithRawToken('any-token');
    expect(app.databaseAdapter).toBe(adapterSingleton);
  });
});

describe('Request Scope (logout)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('logoutWithRawToken returns skipped when token is absent without touching DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', '');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    await expect(scope.logout.logoutWithRawToken(undefined)).resolves.toEqual({
      kind: 'skipped',
      reason: 'no_raw_token',
    });
  });

  it('logoutWithRawToken reports persistence_not_configured when token present but DATABASE_URL missing', async () => {
    vi.stubEnv('DATABASE_URL', '');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    await expect(scope.logout.logoutWithRawToken('token')).resolves.toEqual({
      kind: 'persistence_not_configured',
    });
  });

  it('logoutWithRawToken reports persistence_unavailable when the database connection fails', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://127.0.0.1:1/unreachable_for_logout_scope_test');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    const outcome = await scope.logout.logoutWithRawToken('any');
    expect(outcome.kind).toBe('persistence_unavailable');
  });
});

describe('Request Scope (owner login)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('loginWithEmailPassword reports persistence_not_configured when DATABASE_URL is missing', async () => {
    vi.stubEnv('DATABASE_URL', '');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    await expect(
      scope.ownerLogin.loginWithEmailPassword('a@b.com', 'x'.repeat(12), { ip: null, userAgent: null }),
    ).resolves.toEqual({ kind: 'persistence_not_configured' });
  });

  it('loginWithEmailPassword reports persistence_unavailable when the database connection fails', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://127.0.0.1:1/unreachable_for_owner_login_scope_test');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    const outcome = await scope.ownerLogin.loginWithEmailPassword('a@b.com', 'x'.repeat(12), {
      ip: null,
      userAgent: null,
    });
    expect(outcome.kind).toBe('persistence_unavailable');
  });
});

describe('Request Scope (first-owner setup)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('returns validation outcomes without persistence_not_configured when DATABASE_URL is missing', async () => {
    vi.stubEnv('DATABASE_URL', '');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    await expect(
      scope.firstOwnerSetup.setupFirstOwner('Owner', 'bad-email', 'x'.repeat(12), {
        setCookie: true,
        ip: null,
        userAgent: null,
      }),
    ).resolves.toEqual({
      kind: 'invalid_input',
      field: 'email',
      message: 'Email is invalid',
    });
  });

  it('setupFirstOwner reports persistence_not_configured when DATABASE_URL is missing and payload passes validation', async () => {
    vi.stubEnv('DATABASE_URL', '');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    await expect(
      scope.firstOwnerSetup.setupFirstOwner('Owner', 'o@example.com', 'x'.repeat(12), {
        setCookie: true,
        ip: null,
        userAgent: null,
      }),
    ).resolves.toEqual({ kind: 'persistence_not_configured' });
  });

  it('setupFirstOwner reports persistence_unavailable when the database connection fails', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://127.0.0.1:1/unreachable_for_first_owner_scope_test');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    const outcome = await scope.firstOwnerSetup.setupFirstOwner('Owner', 'o@example.com', 'x'.repeat(12), {
      setCookie: true,
      ip: null,
      userAgent: null,
    });
    expect(outcome.kind).toBe('persistence_unavailable');
  });
});

describe('Session token transport for current-session (GET /auth/me)', () => {
  it('prefers Authorization Bearer over the session cookie', () => {
    const tok = getSessionTokenFromRequest({
      authorization: 'Bearer from-bearer',
      cookie: `${SESSION_COOKIE_NAME}=from-cookie`,
    });
    expect(tok).toEqual({ format: 'bearer', token: 'from-bearer' });
  });

  it('uses the HttpOnly session cookie when Bearer is absent', () => {
    const tok = getSessionTokenFromRequest({
      authorization: undefined,
      cookie: `other=1; ${SESSION_COOKIE_NAME}=${encodeURIComponent('raw-from-cookie')}; x=2`,
    });
    expect(tok).toEqual({ format: 'cookie', token: 'raw-from-cookie' });
  });

  it('returns none when there is no usable bearer or cookie', () => {
    expect(getSessionTokenFromRequest({ authorization: undefined, cookie: undefined })).toEqual({
      format: 'none',
    });
    expect(
      getSessionTokenFromRequest({
        authorization: 'Basic x',
        cookie: 'unrelated=1',
      }),
    ).toEqual({ format: 'none' });
  });
});

describe('Request Scope (current session)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('resolveFromRawToken reports persistence_not_configured when DATABASE_URL is missing', async () => {
    vi.stubEnv('DATABASE_URL', '');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    await expect(scope.currentSession.resolveFromRawToken('any')).resolves.toEqual({
      kind: 'persistence_not_configured',
    });
  });

  it('resolveFromRawToken reports persistence_unavailable when the database connection fails', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://127.0.0.1:1/unreachable_for_current_session_scope_test');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    const outcome = await scope.currentSession.resolveFromRawToken('any');
    expect(outcome.kind).toBe('persistence_unavailable');
  });
});
