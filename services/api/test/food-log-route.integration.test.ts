import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { foodLogEntries, pantryItems, users } from '@healthy/db/schema';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';

import { buildApp } from '../src/app.js';
import {
  insertPersistedPantryItem,
  insertPersistedUserWithBearerSession,
  INTEGRATION_TEST_PLAIN_PASSWORD,
} from './helpers/persisted-builders.js';

describe('Food Log routes (integration)', () => {
  let harness: PostgresTestDatabase;

  beforeAll(async () => {
    harness = await startPostgresTestDatabase();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  beforeEach(async () => {
    await harness.db.delete(foodLogEntries);
    await harness.db.delete(pantryItems);
    await harness.db.delete(users);
    vi.stubEnv('DATABASE_URL', harness.connectionUri);
  });

  it('rejects unauthenticated Food Log day reads', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/food-log/entries?date=2026-04-30',
        headers: { accept: 'application/json' },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.payload)).toEqual({ error: 'unauthorized' });
    } finally {
      await app.close();
    }
  });

  it('returns an empty Food Log Entry list when the owner has no rows for that day', async () => {
    const { authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-empty@example.com',
      displayName: 'Empty Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/food-log/entries?date=2026-04-30',
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ entries: [] });
    } finally {
      await app.close();
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('saves Food Log Entries atomically and returns them for the selected local date', async () => {
    const { user, authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log@example.com',
      displayName: 'Food Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const food = await insertPersistedPantryItem(harness.db, {
      ownerUserId: user.id,
      itemType: 'food',
      name: 'Greek Yogurt',
      iconKey: 'food_bowl',
      metadata: {
        kind: 'food',
        baseAmountGrams: 100,
        nutrients: {
          calories: 120,
          protein: 10,
          fat: 4,
          carbohydrates: 8,
        },
      },
    });

    const app = await buildApp();
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          consumedAt: '2026-04-30T02:44:00.000Z',
          consumedDate: '2026-04-30',
          entries: [
            {
              pantryItemId: food.id,
              quantity: 2,
              servingOption: { kind: 'base' },
            },
          ],
        }),
      });

      expect(createRes.statusCode).toBe(201);
      const createBody = JSON.parse(createRes.payload) as {
        entries: Array<{
          id: string;
          pantryItemId: string;
          displayName: string;
          calories: number;
          proteinGrams: number;
          fatGrams: number;
          carbohydratesGrams: number;
          consumedDate: string;
        }>;
      };
      expect(createBody.entries).toHaveLength(1);
      expect(createBody.entries[0]).toMatchObject({
        pantryItemId: food.id,
        displayName: 'Greek Yogurt',
        calories: 240,
        proteinGrams: 20,
        fatGrams: 8,
        carbohydratesGrams: 16,
        consumedDate: '2026-04-30',
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/food-log/entries?date=2026-04-30',
        headers: authHeaders,
      });

      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.payload) as typeof createBody;
      expect(listBody.entries).toEqual(createBody.entries);
    } finally {
      await app.close();
    }
  });
});
