import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { foodLogEntries, pantryItems, referenceFoods, users } from '@healthy/db/schema';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';

import { buildApp } from '../src/app.js';
import {
  insertPersistedPantryItem,
  insertPersistedReferenceFood,
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
    await harness.db.delete(referenceFoods);
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
          itemSource: string;
          pantryItemId: string;
          displayName: string;
          iconKey: string;
          calories: number;
          proteinGrams: number;
          fatGrams: number;
          carbohydratesGrams: number;
          consumedAt: string;
          consumedDate: string;
          quantity: number;
          servingOption: { kind: string; unit?: string; label?: string };
        }>;
      };
      expect(createBody.entries).toHaveLength(1);
      expect(createBody.entries[0]).toMatchObject({
        itemSource: 'pantry',
        pantryItemId: food.id,
        displayName: 'Greek Yogurt',
        iconKey: 'food_bowl',
        calories: 240,
        proteinGrams: 20,
        fatGrams: 8,
        carbohydratesGrams: 16,
        consumedAt: '2026-04-30T02:44:00.000Z',
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

  it('saves Food Log Entries for pantry recipes (full yield and per serving)', async () => {
    const { user, authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-recipe@example.com',
      displayName: 'Recipe Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const recipe = await insertPersistedPantryItem(harness.db, {
      ownerUserId: user.id,
      itemType: 'recipe',
      name: 'Chili',
      iconKey: 'recipe_pot',
      metadata: {
        kind: 'recipe',
        servings: 2,
        servingLabel: 'bowl',
        nutrients: {
          calories: 400,
          protein: 20,
          fat: 10,
          carbohydrates: 40,
        },
        nutrientsPerServing: {
          calories: 200,
          protein: 10,
          fat: 5,
          carbohydrates: 20,
        },
      },
    });

    const app = await buildApp();
    try {
      const fullRes = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          consumedAt: '2026-05-10T12:00:00.000Z',
          consumedDate: '2026-05-10',
          entries: [{ pantryItemId: recipe.id, quantity: 1, servingOption: { kind: 'base' } }],
        }),
      });
      expect(fullRes.statusCode).toBe(201);
      const fullBody = JSON.parse(fullRes.payload) as {
        entries: Array<{ calories: number; servingOption: { kind: string } }>;
      };
      expect(fullBody.entries[0]).toMatchObject({
        calories: 400,
        servingOption: { kind: 'base' },
      });

      const perRes = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          consumedAt: '2026-05-10T13:00:00.000Z',
          consumedDate: '2026-05-10',
          entries: [
            { pantryItemId: recipe.id, quantity: 2, servingOption: { kind: 'unit', unit: 'serving' } },
          ],
        }),
      });
      expect(perRes.statusCode).toBe(201);
      const perBody = JSON.parse(perRes.payload) as {
        entries: Array<{ calories: number; servingOption: { kind: string; unit?: string } }>;
      };
      expect(perBody.entries[0]).toMatchObject({
        calories: 400,
        servingOption: { kind: 'unit', unit: 'serving' },
      });
    } finally {
      await app.close();
    }
  });

  it('lists entries for a local date in ascending consumedAt order', async () => {
    const { user, authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-order@example.com',
      displayName: 'Order Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const food = await insertPersistedPantryItem(harness.db, {
      ownerUserId: user.id,
      itemType: 'food',
      name: 'Apple',
      iconKey: 'food_bowl',
      metadata: {
        kind: 'food',
        baseAmountGrams: 100,
        nutrients: {
          calories: 52,
          protein: 0.3,
          fat: 0.2,
          carbohydrates: 14,
        },
      },
    });

    const app = await buildApp();
    try {
      const later = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        payload: JSON.stringify({
          consumedAt: '2026-06-15T20:00:00.000Z',
          consumedDate: '2026-06-15',
          entries: [{ pantryItemId: food.id, quantity: 1, servingOption: { kind: 'base' } }],
        }),
      });
      expect(later.statusCode).toBe(201);

      const earlier = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        payload: JSON.stringify({
          consumedAt: '2026-06-15T08:00:00.000Z',
          consumedDate: '2026-06-15',
          entries: [{ pantryItemId: food.id, quantity: 1, servingOption: { kind: 'base' } }],
        }),
      });
      expect(earlier.statusCode).toBe(201);

      const listRes = await app.inject({
        method: 'GET',
        url: '/food-log/entries?date=2026-06-15',
        headers: authHeaders,
      });
      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.payload) as { entries: Array<{ id: string }> };
      expect(listBody.entries).toHaveLength(2);
      const createEarlier = JSON.parse(earlier.payload) as { entries: Array<{ id: string }> };
      const createLater = JSON.parse(later.payload) as { entries: Array<{ id: string }> };
      expect(listBody.entries[0]!.id).toBe(createEarlier.entries[0]!.id);
      expect(listBody.entries[1]!.id).toBe(createLater.entries[0]!.id);
    } finally {
      await app.close();
    }
  });

  it('returns only entries for the requested consumedDate, not adjacent days', async () => {
    const { user, authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-date-scope@example.com',
      displayName: 'Date Scope Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const food = await insertPersistedPantryItem(harness.db, {
      ownerUserId: user.id,
      itemType: 'food',
      name: 'Banana',
      iconKey: 'food_bowl',
      metadata: {
        kind: 'food',
        baseAmountGrams: 100,
        nutrients: {
          calories: 89,
          protein: 1.1,
          fat: 0.3,
          carbohydrates: 23,
        },
      },
    });

    const app = await buildApp();
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        payload: JSON.stringify({
          consumedAt: '2026-07-01T12:00:00.000Z',
          consumedDate: '2026-07-01',
          entries: [{ pantryItemId: food.id, quantity: 1, servingOption: { kind: 'base' } }],
        }),
      });
      expect(createRes.statusCode).toBe(201);

      const nextDayRes = await app.inject({
        method: 'GET',
        url: '/food-log/entries?date=2026-07-02',
        headers: authHeaders,
      });
      expect(nextDayRes.statusCode).toBe(200);
      expect(JSON.parse(nextDayRes.payload)).toEqual({ entries: [] });

      const prevDayRes = await app.inject({
        method: 'GET',
        url: '/food-log/entries?date=2026-06-30',
        headers: authHeaders,
      });
      expect(prevDayRes.statusCode).toBe(200);
      expect(JSON.parse(prevDayRes.payload)).toEqual({ entries: [] });

      const sameDayRes = await app.inject({
        method: 'GET',
        url: '/food-log/entries?date=2026-07-01',
        headers: authHeaders,
      });
      expect(sameDayRes.statusCode).toBe(200);
      const sameBody = JSON.parse(sameDayRes.payload) as { entries: Array<{ displayName: string }> };
      expect(sameBody.entries).toHaveLength(1);
      expect(sameBody.entries[0]!.displayName).toBe('Banana');
    } finally {
      await app.close();
    }
  });

  it('does not list another owner Food Log entries for the same local date', async () => {
    const { user: ownerA, authHeaders: headersA } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-owner-a@example.com',
      displayName: 'Owner A',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const { authHeaders: headersB } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-owner-b@example.com',
      displayName: 'Owner B',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const food = await insertPersistedPantryItem(harness.db, {
      ownerUserId: ownerA.id,
      itemType: 'food',
      name: 'Secret Snack',
      iconKey: 'food_bowl',
      metadata: {
        kind: 'food',
        baseAmountGrams: 100,
        nutrients: {
          calories: 200,
          protein: 5,
          fat: 8,
          carbohydrates: 28,
        },
      },
    });

    const app = await buildApp();
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: { ...headersA, 'content-type': 'application/json' },
        payload: JSON.stringify({
          consumedAt: '2026-08-10T09:00:00.000Z',
          consumedDate: '2026-08-10',
          entries: [{ pantryItemId: food.id, quantity: 1, servingOption: { kind: 'base' } }],
        }),
      });
      expect(createRes.statusCode).toBe(201);

      const bListRes = await app.inject({
        method: 'GET',
        url: '/food-log/entries?date=2026-08-10',
        headers: headersB,
      });
      expect(bListRes.statusCode).toBe(200);
      expect(JSON.parse(bListRes.payload)).toEqual({ entries: [] });

      const aListRes = await app.inject({
        method: 'GET',
        url: '/food-log/entries?date=2026-08-10',
        headers: headersA,
      });
      expect(aListRes.statusCode).toBe(200);
      const aBody = JSON.parse(aListRes.payload) as { entries: Array<{ displayName: string }> };
      expect(aBody.entries).toHaveLength(1);
      expect(aBody.entries[0]!.displayName).toBe('Secret Snack');
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

  it('logs an active Reference Food by grams with catalog icon and snapshot identifiers', async () => {
    const { user, authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-ref@example.com',
      displayName: 'Ref Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const ref = await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: '12345',
      displayName: 'Test Apple',
      baseAmountGrams: 100,
      calories: 52,
      proteinGrams: 0.3,
      fatGrams: 0.2,
      carbohydratesGrams: 14,
      iconKey: 'food_apple',
    });

    const app = await buildApp();
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        payload: JSON.stringify({
          consumedAt: '2026-09-01T10:00:00.000Z',
          consumedDate: '2026-09-01',
          entries: [{ referenceFoodId: ref.id, grams: 200 }],
        }),
      });
      expect(createRes.statusCode).toBe(201);
      const body = JSON.parse(createRes.payload) as {
        entries: Array<{
          itemSource: string;
          referenceFoodId?: string;
          referenceFoodSource?: string;
          referenceSourceFoodId?: string;
          pantryItemId?: string;
          displayName: string;
          iconKey: string;
          quantity: number;
          servingOption: { kind: string; label?: string };
          calories: number;
        }>;
      };
      expect(body.entries[0]).toMatchObject({
        itemSource: 'reference_food',
        referenceFoodId: ref.id,
        referenceFoodSource: 'usda_fdc',
        referenceSourceFoodId: '12345',
        displayName: 'Test Apple',
        iconKey: 'food_apple',
        quantity: 200,
        servingOption: { kind: 'custom', label: 'g' },
      });
      expect(body.entries[0]!.calories).toBeCloseTo(104, 5);
      expect(body.entries[0]!.pantryItemId).toBeUndefined();

      const listRes = await app.inject({
        method: 'GET',
        url: '/food-log/entries?date=2026-09-01',
        headers: authHeaders,
      });
      expect(listRes.statusCode).toBe(200);
      expect(JSON.parse(listRes.payload)).toEqual(body);
    } finally {
      await app.close();
    }
  });

  it('rejects inactive Reference Foods for new logging', async () => {
    const { authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-ref-inact@example.com',
      displayName: 'Inactive Ref',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const ref = await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: '999',
      displayName: 'Retired',
      baseAmountGrams: 100,
      calories: 10,
      proteinGrams: 1,
      fatGrams: 0,
      carbohydratesGrams: 2,
      isActive: false,
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        payload: JSON.stringify({
          consumedAt: '2026-09-02T10:00:00.000Z',
          consumedDate: '2026-09-02',
          entries: [{ referenceFoodId: ref.id, grams: 50 }],
        }),
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload)).toMatchObject({ error: 'invalid_input' });
    } finally {
      await app.close();
    }
  });

  it('rejects unknown Reference Food ids', async () => {
    const { authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-ref-miss@example.com',
      displayName: 'Missing Ref',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        payload: JSON.stringify({
          consumedAt: '2026-09-03T10:00:00.000Z',
          consumedDate: '2026-09-03',
          entries: [
            {
              referenceFoodId: '00000000-0000-4000-8000-000000000001',
              grams: 10,
            },
          ],
        }),
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('rejects batch entries that specify both pantry and reference identifiers', async () => {
    const { user, authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-both@example.com',
      displayName: 'Both Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const food = await insertPersistedPantryItem(harness.db, {
      ownerUserId: user.id,
      itemType: 'food',
      name: 'X',
      iconKey: 'food_bowl',
      metadata: {
        kind: 'food',
        baseAmountGrams: 100,
        nutrients: { calories: 100, protein: 1, fat: 1, carbohydrates: 1 },
      },
    });
    const ref = await insertPersistedReferenceFood(harness.db, {
      source: 't',
      sourceFoodId: '1',
      displayName: 'R',
      baseAmountGrams: 100,
      calories: 100,
      proteinGrams: 1,
      fatGrams: 1,
      carbohydratesGrams: 1,
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        payload: JSON.stringify({
          consumedAt: '2026-09-04T10:00:00.000Z',
          consumedDate: '2026-09-04',
          entries: [
            {
              pantryItemId: food.id,
              referenceFoodId: ref.id,
              quantity: 1,
              grams: 10,
              servingOption: { kind: 'base' },
            },
          ],
        }),
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('accepts a batch mixing Pantry and Reference Food entries', async () => {
    const { user, authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'food-log-mix@example.com',
      displayName: 'Mix Logger',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    const food = await insertPersistedPantryItem(harness.db, {
      ownerUserId: user.id,
      itemType: 'food',
      name: 'Yogurt',
      iconKey: 'food_bowl',
      metadata: {
        kind: 'food',
        baseAmountGrams: 100,
        nutrients: { calories: 60, protein: 5, fat: 2, carbohydrates: 7 },
      },
    });
    const ref = await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'mix-1',
      displayName: 'Catalog Oats',
      baseAmountGrams: 40,
      calories: 150,
      proteinGrams: 5,
      fatGrams: 3,
      carbohydratesGrams: 27,
    });

    const app = await buildApp();
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        payload: JSON.stringify({
          consumedAt: '2026-09-05T12:00:00.000Z',
          consumedDate: '2026-09-05',
          entries: [
            { pantryItemId: food.id, quantity: 1, servingOption: { kind: 'base' } },
            { referenceFoodId: ref.id, grams: 40 },
          ],
        }),
      });
      expect(createRes.statusCode).toBe(201);
      const body = JSON.parse(createRes.payload) as { entries: Array<{ itemSource: string }> };
      expect(body.entries).toHaveLength(2);
      expect(body.entries.map((e) => e.itemSource)).toEqual(['pantry', 'reference_food']);
    } finally {
      await app.close();
    }
  });
});
