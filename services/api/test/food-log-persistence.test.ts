import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { foodLogEntries, users } from '@healthy/db/schema';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { listFoodLogEntriesForOwnerDate } from '../src/food-log/food-log-persistence.js';
import { insertPersistedUser } from './helpers/persisted-builders.js';

describe('listFoodLogEntriesForOwnerDate', () => {
  let harness: PostgresTestDatabase;

  beforeAll(async () => {
    harness = await startPostgresTestDatabase();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  beforeEach(async () => {
    await harness.db.delete(foodLogEntries);
    await harness.db.delete(users);
  });

  it('omits rows with deletedAt set when listing a calendar day (future soft-delete UX)', async () => {
    const now = new Date();
    const user = await insertPersistedUser(harness.db, {
      email: 'food-log-soft-del@example.com',
      passwordHash: await hashPasswordArgon2id('goodpassword12'),
      displayName: 'Soft Del',
      role: 'owner',
      status: 'active',
    });

    await harness.db.insert(foodLogEntries).values({
      ownerUserId: user.id,
      pantryItemId: null,
      pantryItemType: 'food',
      displayName: 'Apple',
      iconKey: 'food_apple',
      consumedAt: now,
      consumedDate: '2026-07-02',
      servingKind: 'base',
      servingUnitKey: null,
      servingCustomLabel: null,
      quantity: 1,
      calories: 50,
      proteinGrams: 0,
      fatGrams: 0,
      carbohydratesGrams: 14,
      updatedAt: now,
      deletedAt: null,
    });

    await harness.db.insert(foodLogEntries).values({
      ownerUserId: user.id,
      pantryItemId: null,
      pantryItemType: 'food',
      displayName: 'Banana',
      iconKey: 'food_banana',
      consumedAt: now,
      consumedDate: '2026-07-02',
      servingKind: 'base',
      servingUnitKey: null,
      servingCustomLabel: null,
      quantity: 1,
      calories: 90,
      proteinGrams: 1,
      fatGrams: 0,
      carbohydratesGrams: 23,
      updatedAt: now,
      deletedAt: now,
    });

    const active = await listFoodLogEntriesForOwnerDate(harness.db, user.id, '2026-07-02');
    expect(active).toHaveLength(1);
    expect(active[0]?.displayName).toBe('Apple');

    await harness.db
      .update(foodLogEntries)
      .set({ deletedAt: now })
      .where(eq(foodLogEntries.displayName, 'Apple'));

    const remaining = await listFoodLogEntriesForOwnerDate(harness.db, user.id, '2026-07-02');
    expect(remaining).toHaveLength(0);
  });
});
