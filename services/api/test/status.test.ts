import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type { RequestScope } from '../src/request-scope/index.js';

function unusedCurrentSession(): RequestScope['currentSession'] {
  return {
    async resolveFromRawToken(_rawToken: string) {
      return { kind: 'unauthorized' as const, reason: 'missing_session' as const };
    },
  };
}

function unusedLogout(): RequestScope['logout'] {
  return {
    async logoutWithRawToken() {
      return { kind: 'skipped', reason: 'no_raw_token' };
    },
  };
}

describe('GET /status', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('returns setupRequired true when there is no active owner', async () => {
    app = await buildApp({
      requestScope: {
        status: {
          async activeOwnerExists() {
            return { kind: 'ok', hasActiveOwner: false };
          },
        },
        currentSession: unusedCurrentSession(),
        logout: unusedLogout(),
      },
    });

    const res = await app.inject({ method: 'GET', url: '/status', headers: { accept: 'application/json' } });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as {
      api: { name: string; version: string };
      setupRequired: boolean;
    };
    expect(body).toEqual({
      api: { name: 'healthy-api', version: '0.0.1' },
      setupRequired: true,
    });
  });

  it('returns setupRequired false when an active owner exists', async () => {
    app = await buildApp({
      requestScope: {
        status: {
          async activeOwnerExists() {
            return { kind: 'ok', hasActiveOwner: true };
          },
        },
        currentSession: unusedCurrentSession(),
        logout: unusedLogout(),
      },
    });

    const res = await app.inject({ method: 'GET', url: '/status', headers: { accept: 'application/json' } });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as {
      api: { name: string; version: string };
      setupRequired: boolean;
    };
    expect(body).toEqual({
      api: { name: 'healthy-api', version: '0.0.1' },
      setupRequired: false,
    });
  });

  it('returns 503 service_unavailable when DATABASE_URL is not configured and scope is default', async () => {
    vi.stubEnv('DATABASE_URL', '');
    app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/status', headers: { accept: 'application/json' } });

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
  });

  it('returns 503 service_unavailable when request scope reports persistence_unavailable', async () => {
    app = await buildApp({
      requestScope: {
        status: {
          async activeOwnerExists() {
            return { kind: 'persistence_unavailable' };
          },
        },
        currentSession: unusedCurrentSession(),
        logout: unusedLogout(),
      },
    });

    const res = await app.inject({ method: 'GET', url: '/status', headers: { accept: 'application/json' } });
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
  });
});
