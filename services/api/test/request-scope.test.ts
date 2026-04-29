import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { registerEnv } from '../src/config/env.js';
import { getSessionTokenFromRequest } from '../src/auth/parse-bearer-cookie.js';
import { SESSION_COOKIE_NAME } from '../src/auth/session-token.js';
import { createRequestScopeForApp, type RequestScope } from '../src/request-scope/index.js';

describe('Request Scope (public status / active owner)', () => {
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
    await expect(scope.status.activeOwnerExists()).resolves.toEqual({ kind: 'persistence_not_configured' });
  });

  it('reports persistence_not_configured when DATABASE_URL is only whitespace', async () => {
    vi.stubEnv('DATABASE_URL', '   \t  ');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    await expect(scope.status.activeOwnerExists()).resolves.toEqual({ kind: 'persistence_not_configured' });
  });

  it('allows a fake RequestScope for status capability wiring in route tests', async () => {
    const fake: RequestScope = {
      status: {
        async activeOwnerExists() {
          return { kind: 'ok', hasActiveOwner: true };
        },
      },
      currentSession: {
        async resolveFromRawToken() {
          return { kind: 'unauthorized', reason: 'missing_session' };
        },
      },
    };
    await expect(fake.status.activeOwnerExists()).resolves.toEqual({
      kind: 'ok',
      hasActiveOwner: true,
    });
  });

  it('reports persistence_unavailable when the database connection fails', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://127.0.0.1:1/unreachable_for_status_scope_test');
    app = Fastify({ logger: false });
    await registerEnv(app);
    const scope = createRequestScopeForApp(app);
    const outcome = await scope.status.activeOwnerExists();
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
