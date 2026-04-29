import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';

describe('POST /auth/logout (unit)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 503 when DATABASE_URL is not configured', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'POST', url: '/auth/logout' });
      expect(res.statusCode).toBe(503);
    } finally {
      await app.close();
    }
  });
});
