import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';

describe('POST /auth/login (unit)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 503 when DATABASE_URL is not configured', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'a@b.com', password: 'x'.repeat(12) }),
      });
      expect(res.statusCode).toBe(503);
    } finally {
      await app.close();
    }
  });

  it('invokes injected runLogin handler', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/healthy_test');
    const app = await buildApp({
      ownerLoginRouteOptions: {
        runLogin: async (_req, reply) => {
          return reply.status(401).send({ error: 'invalid_credentials' });
        },
      },
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'a@b.com', password: 'anything' }),
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
