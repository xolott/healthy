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
          quantity: number;
          servingOption: { kind: string; unit?: string; label?: string };
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
        quantity: 2,
        servingOption: { kind: 'base' },
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

  it('rejects base serving for food that defines serving options', async () => {
    const { user, authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-opt@example.com',
      displayName: 'Option Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const food = await insertPersistedPantryItem(harness.db, {
      ownerUserId: user.id,
      itemType: 'food',
      name: 'Toast',
      iconKey: 'food_bowl',
      metadata: {
        kind: 'food',
        baseAmountGrams: 100,
        nutrients: {
          calories: 260,
          protein: 9,
          fat: 4,
          carbohydrates: 48,
        },
        servingOptions: [{ kind: 'unit', unit: 'slice', grams: 33 }],
      },
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          consumedAt: '2026-05-01T12:00:00.000Z',
          consumedDate: '2026-05-01',
          entries: [{ pantryItemId: food.id, quantity: 1, servingOption: { kind: 'base' } }],
        }),
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload)).toMatchObject({ error: 'invalid_input', field: expect.any(String) });
    } finally {
      await app.close();
    }
  });

  it('accepts predefined unit servings, snapshots totals, and returns quantity + servingOption', async () => {
    const { user, authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-unit@example.com',
      displayName: 'Unit Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const food = await insertPersistedPantryItem(harness.db, {
      ownerUserId: user.id,
      itemType: 'food',
      name: 'Toast',
      iconKey: 'food_bowl',
      metadata: {
        kind: 'food',
        baseAmountGrams: 100,
        nutrients: {
          calories: 100,
          protein: 4,
          fat: 2,
          carbohydrates: 16,
        },
        servingOptions: [{ kind: 'unit', unit: 'slice', grams: 40 }],
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
          consumedAt: '2026-05-02T14:30:00.000Z',
          consumedDate: '2026-05-02',
          entries: [{ pantryItemId: food.id, quantity: 2, servingOption: { kind: 'unit', unit: 'slice' } }],
        }),
      });
      expect(createRes.statusCode).toBe(201);
      const createBody = JSON.parse(createRes.payload) as {
        entries: Array<{
          calories: number;
          proteinGrams: number;
          fatGrams: number;
          carbohydratesGrams: number;
          quantity: number;
          servingOption: { kind: string; unit?: string };
        }>;
      };
      expect(createBody.entries[0]).toMatchObject({
        quantity: 2,
        servingOption: { kind: 'unit', unit: 'slice' },
      });
      const sliceEntry = createBody.entries[0]!;
      expect(sliceEntry.calories).toBeCloseTo(80, 5);
      expect(sliceEntry.proteinGrams).toBeCloseTo(3.2, 5);
      expect(sliceEntry.fatGrams).toBeCloseTo(1.6, 5);
      expect(sliceEntry.carbohydratesGrams).toBeCloseTo(12.8, 5);
    } finally {
      await app.close();
    }
  });

  it('accepts custom label servings matching metadata', async () => {
    const { user, authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-custom@example.com',
      displayName: 'Custom Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const food = await insertPersistedPantryItem(harness.db, {
      ownerUserId: user.id,
      itemType: 'food',
      name: 'Pizza',
      iconKey: 'food_bowl',
      metadata: {
        kind: 'food',
        baseAmountGrams: 100,
        nutrients: {
          calories: 300,
          protein: 12,
          fat: 10,
          carbohydrates: 36,
        },
        servingOptions: [{ kind: 'custom', label: 'Corner piece', grams: 80 }],
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
          consumedAt: '2026-05-03T18:00:00.000Z',
          consumedDate: '2026-05-03',
          entries: [
            { pantryItemId: food.id, quantity: 1, servingOption: { kind: 'custom', label: 'Corner piece' } },
          ],
        }),
      });
      expect(createRes.statusCode).toBe(201);
      const createBody = JSON.parse(createRes.payload) as {
        entries: Array<{ calories: number; servingOption: { kind: string; label?: string } }>;
      };
      expect(createBody.entries[0]).toMatchObject({
        calories: 240,
        servingOption: { kind: 'custom', label: 'Corner piece' },
      });
    } finally {
      await app.close();
    }
  });

  it('rejects mismatched serving option for foods with servings', async () => {
    const { user, authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-wrong-unit@example.com',
      displayName: 'Mismatch Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const food = await insertPersistedPantryItem(harness.db, {
      ownerUserId: user.id,
      itemType: 'food',
      name: 'Rice cake',
      iconKey: 'food_bowl',
      metadata: {
        kind: 'food',
        baseAmountGrams: 50,
        nutrients: {
          calories: 60,
          protein: 1,
          fat: 1,
          carbohydrates: 12,
        },
        servingOptions: [{ kind: 'unit', unit: 'cake', grams: 25 }],
      },
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          consumedAt: '2026-05-04T09:00:00.000Z',
          consumedDate: '2026-05-04',
          entries: [{ pantryItemId: food.id, quantity: 1, servingOption: { kind: 'unit', unit: 'slice' } }],
        }),
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
