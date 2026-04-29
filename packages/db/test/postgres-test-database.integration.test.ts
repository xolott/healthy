import { describe, expect, it } from 'vitest';

import { users } from '../src/schema/index.js';
import { startPostgresTestDatabase } from '@healthy/db/test';

describe('startPostgresTestDatabase', () => {
  it('starts Postgres with migrations, exposes URI without raw client, disposes cleanly', async () => {
    const harness = await startPostgresTestDatabase();
    expect(harness.connectionUri).toMatch(/^postgres(ql)?:\/\//);
    expect('client' in harness).toBe(false);

    const rows = await harness.db.select().from(users).limit(1);
    expect(Array.isArray(rows)).toBe(true);

    await harness.dispose();
  });
});
