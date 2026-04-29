import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';

describe('DATABASE_URL vs buildApp', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('starts when DATABASE_URL is unset (health-only)', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const app = await buildApp();
    expect(app.databaseAdapter).toBeNull();
    await app.close();
  });

  it('starts when DATABASE_URL is a valid postgres URL without a startup query', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/healthy_test');
    const app = await buildApp();
    expect(app.databaseAdapter).not.toBeNull();
    await app.close();
  });

  it('fails fast when DATABASE_URL is not a URL', async () => {
    vi.stubEnv('DATABASE_URL', 'totally-not-a-url');
    await expect(buildApp()).rejects.toThrow(/not a valid URL/);
  });

  it('fails fast when DATABASE_URL is not postgres', async () => {
    vi.stubEnv('DATABASE_URL', 'http://localhost:5432/db');
    await expect(buildApp()).rejects.toThrow(/postgres/);
  });
});
