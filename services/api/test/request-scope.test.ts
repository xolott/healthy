import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { registerEnv } from '../src/config/env.js';
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
