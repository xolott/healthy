import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import { MIN_PASSWORD_LENGTH } from '../src/auth/password-policy.js';

describe('POST /setup/first-owner', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('returns 400 with password_policy for a short password before DB', async () => {
    app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/setup/first-owner',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        displayName: 'Owner',
        email: 'o@example.com',
        password: '12345678901',
      }),
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload) as { error: string; minLength: number };
    expect(body.error).toBe('password_policy');
    expect(body.minLength).toBe(12);
  });

  it('returns 503 when DATABASE_URL is not configured and password is valid', async () => {
    vi.stubEnv('DATABASE_URL', '');
    app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/setup/first-owner',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        displayName: 'Owner',
        email: 'o@example.com',
        password: 'x'.repeat(MIN_PASSWORD_LENGTH),
      }),
    });
    expect(res.statusCode).toBe(503);
  });
});

describe('GET /auth/me', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('returns 401 without session', async () => {
    app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 503 when DATABASE_URL is not configured and a Bearer token is present', async () => {
    vi.stubEnv('DATABASE_URL', '');
    app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer sometoken' },
    });
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
  });

  it('returns 503 service_unavailable when request scope reports persistence_unavailable', async () => {
    app = await buildApp({
      requestScope: {
        status: {
          async activeOwnerExists() {
            return { kind: 'ok', hasActiveOwner: true };
          },
        },
        currentSession: {
          async resolveFromRawToken() {
            return { kind: 'persistence_unavailable' };
          },
        },
        logout: {
          async logoutWithRawToken() {
            return { kind: 'skipped', reason: 'no_raw_token' };
          },
        },
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer sometoken' },
    });
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
  });
});

describe('GET /auth/me (request-scope stub)', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('returns 200 with user when request scope currentSession returns ok', async () => {
    app = await buildApp({
      requestScope: {
        status: {
          async activeOwnerExists() {
            return { kind: 'ok', hasActiveOwner: true };
          },
        },
        currentSession: {
          async resolveFromRawToken() {
            return {
              kind: 'ok',
              user: { id: '1', email: 'a@b', displayName: 'A', role: 'owner' },
            };
          },
        },
        logout: {
          async logoutWithRawToken() {
            return { kind: 'skipped', reason: 'no_raw_token' };
          },
        },
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer stub-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({
      user: { id: '1', email: 'a@b', displayName: 'A', role: 'owner' },
    });
  });
});
