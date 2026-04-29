import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';

describe('POST /auth/logout (unit)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 204 when DATABASE_URL is not configured and no session token is sent', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'POST', url: '/auth/logout' });
      expect(res.statusCode).toBe(204);
    } finally {
      await app.close();
    }
  });

  it('returns 503 when DATABASE_URL is not configured but a Bearer token is present', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: 'Bearer sometoken' },
      });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
    } finally {
      await app.close();
    }
  });

  it('returns 503 service_unavailable when Request Scope reports persistence_unavailable', async () => {
    const app = await buildApp({
      requestScope: {
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
            return { kind: 'persistence_unavailable' };
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
      },
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: 'Bearer sometoken' },
      });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
    } finally {
      await app.close();
    }
  });
});
