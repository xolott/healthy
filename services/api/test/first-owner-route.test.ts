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
});

describe('GET /auth/me (stubbed)', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('returns 200 with user when getUser is injected', async () => {
    app = await buildApp({
      authMeRouteOptions: {
        getUser: async (_req, reply) => {
          return reply.status(200).send({
            user: { id: '1', email: 'a@b', displayName: 'A', role: 'owner' as const },
          });
        },
      },
    });
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(200);
  });
});
