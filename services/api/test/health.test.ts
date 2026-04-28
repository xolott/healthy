import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';

describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('returns scaffold payload', async () => {
    app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/health', headers: { accept: 'application/json' } });

    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.payload);

    expect(body).toMatchObject({
      status: 'ok',
      service: 'healthy-api',
    });
    expect(typeof body.time).toBe('string');
  });
});
