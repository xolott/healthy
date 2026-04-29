import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseAdapter } from '../src/index.js';
import { users } from '../src/schema/index.js';
import { startPostgresIntegration, type IntegrationHarness } from './helpers/integration-db.js';

describe('createDatabaseAdapter (integration)', () => {
  let harness: IntegrationHarness;

  beforeAll(async () => {
    harness = await startPostgresIntegration();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it('exposes a Drizzle handle that can query, then closes cleanly', async () => {
    const adapter = createDatabaseAdapter(harness.connectionUri);
    const rows = await adapter.db.select().from(users).limit(1);
    expect(Array.isArray(rows)).toBe(true);
    await expect(adapter.close()).resolves.toBeUndefined();
    await expect(adapter.db.select().from(users).limit(1)).rejects.toThrow();
  });
});
