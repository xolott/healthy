import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';

describe('GET /status', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('returns setupRequired true when there is no active owner', async () => {
    app = await buildApp({
      statusRouteDeps: {
        async hasActiveOwner() {
          return false;
        },
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
      statusRouteDeps: {
        async hasActiveOwner() {
          return true;
        },
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

  it('returns 503 when DATABASE_URL is not configured and route is not overridden', async () => {
    app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/status', headers: { accept: 'application/json' } });

    expect(res.statusCode).toBe(503);
  });
});
