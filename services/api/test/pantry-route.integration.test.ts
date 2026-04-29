import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { users } from '@healthy/db/schema';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { generateSessionToken } from '../src/auth/session-token.js';
import { buildApp } from '../src/app.js';
import { STORED_GRAMS_FOR_ONE_OUNCE } from '../src/pantry/create-food-payload.js';
import { PANTRY_ICON_KEYS } from '../src/pantry/pantry-icon-keys.js';
import {
  insertPersistedPantryItem,
  insertPersistedSession,
  insertPersistedUser,
  persistedFindPantryItemById,
} from './helpers/persisted-builders.js';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';

const goodPassword = 'goodpassword12';

describe('Pantry routes (integration)', () => {
  let harness: PostgresTestDatabase;

  beforeAll(async () => {
    harness = await startPostgresTestDatabase();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  beforeEach(async () => {
    await harness.db.delete(users);
    vi.stubEnv('DATABASE_URL', harness.connectionUri);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('GET /pantry/reference returns 401 without a token', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/pantry/reference' });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('GET /pantry/reference returns seeded nutrients and stable ordered icon keys', async () => {
    const owner = await insertPersistedUser(harness.db, {
      email: 'pantry-ref@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Pantry Tester',
      role: 'owner',
      status: 'active',
    });
    const { rawToken, tokenHash } = generateSessionToken();
    await insertPersistedSession(harness.db, {
      userId: owner.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/pantry/reference',
        headers: {
          authorization: `Bearer ${rawToken}`,
          accept: 'application/json',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload) as {
        nutrients: { key: string; displayName: string; canonicalUnit: string }[];
        iconKeys: string[];
      };
      expect(body.nutrients).toHaveLength(4);
      expect(body.nutrients.map((n) => n.key)).toEqual([
        'calories',
        'carbohydrates',
        'fat',
        'protein',
      ]);
      expect(body.iconKeys).toEqual([...PANTRY_ICON_KEYS]);
    } finally {
      await app.close();
    }
  });

  it('GET /pantry/items returns empty catalog for Foods when another user owns items only', async () => {
    const userA = await insertPersistedUser(harness.db, {
      email: 'user-a@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'User A',
      role: 'owner',
      status: 'active',
    });
    const userB = await insertPersistedUser(harness.db, {
      email: 'user-b@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'User B',
      role: 'owner',
      status: 'active',
    });

    await insertPersistedPantryItem(harness.db, {
      ownerUserId: userB.id,
      itemType: 'food',
      name: 'Other User Tomato',
      iconKey: 'food_apple',
    });

    const { rawToken, tokenHash } = generateSessionToken();
    await insertPersistedSession(harness.db, {
      userId: userA.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/pantry/items?itemType=food',
        headers: {
          authorization: `Bearer ${rawToken}`,
          accept: 'application/json',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload) as { items: unknown[] };
      expect(body.items).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('GET /pantry/items separates Foods and Recipes by itemType query', async () => {
    const owner = await insertPersistedUser(harness.db, {
      email: 'list@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Lister',
      role: 'owner',
      status: 'active',
    });
    await insertPersistedPantryItem(harness.db, {
      ownerUserId: owner.id,
      itemType: 'food',
      name: 'My Oats',
      iconKey: 'food_bowl',
    });
    await insertPersistedPantryItem(harness.db, {
      ownerUserId: owner.id,
      itemType: 'recipe',
      name: 'My Chili',
      iconKey: 'recipe_pot',
    });

    const { rawToken, tokenHash } = generateSessionToken();
    await insertPersistedSession(harness.db, {
      userId: owner.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const app = await buildApp();
    try {
      let res = await app.inject({
        method: 'GET',
        url: '/pantry/items?itemType=food',
        headers: {
          authorization: `Bearer ${rawToken}`,
          accept: 'application/json',
        },
      });
      let body = JSON.parse(res.payload) as { items: { name: string }[] };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.name).toBe('My Oats');

      res = await app.inject({
        method: 'GET',
        url: '/pantry/items?itemType=recipe',
        headers: {
          authorization: `Bearer ${rawToken}`,
          accept: 'application/json',
        },
      });
      body = JSON.parse(res.payload) as { items: { name: string }[] };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.name).toBe('My Chili');
    } finally {
      await app.close();
    }
  });

  it('GET /pantry/items/:id returns detail for owned item, 404 for unknown id or other owner', async () => {
    const owner = await insertPersistedUser(harness.db, {
      email: 'detail@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Detail Owner',
      role: 'owner',
      status: 'active',
    });
    const other = await insertPersistedUser(harness.db, {
      email: 'other-detail@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Other Owner',
      role: 'owner',
      status: 'active',
    });

    const mine = await insertPersistedPantryItem(harness.db, {
      ownerUserId: owner.id,
      itemType: 'food',
      name: 'Detail Food',
      iconKey: 'food_egg',
    });

    const theirs = await insertPersistedPantryItem(harness.db, {
      ownerUserId: other.id,
      itemType: 'food',
      name: 'Not Mine',
      iconKey: 'food_milk',
    });

    const { rawToken, tokenHash } = generateSessionToken();
    await insertPersistedSession(harness.db, {
      userId: owner.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const app = await buildApp();
    try {
      let res = await app.inject({
        method: 'GET',
        url: `/pantry/items/${mine.id}`,
        headers: {
          authorization: `Bearer ${rawToken}`,
          accept: 'application/json',
        },
      });
      expect(res.statusCode).toBe(200);
      const detail = JSON.parse(res.payload) as { item: { id: string; name: string; itemType: string } };
      expect(detail.item.name).toBe('Detail Food');

      res = await app.inject({
        method: 'GET',
        url: '/pantry/items/00000000-0000-0000-0000-000000000001',
        headers: {
          authorization: `Bearer ${rawToken}`,
          accept: 'application/json',
        },
      });
      expect(res.statusCode).toBe(404);

      res = await app.inject({
        method: 'GET',
        url: `/pantry/items/${theirs.id}`,
        headers: {
          authorization: `Bearer ${rawToken}`,
          accept: 'application/json',
        },
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }

    expect(await persistedFindPantryItemById(harness.db, mine.id)).toBeDefined();
  });

  it('POST /pantry/items/food returns 401 without a token', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/pantry/items/food',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        payload: {
          name: 'X',
          iconKey: 'food_apple',
          baseAmount: { value: 1, unit: 'g' },
          nutrients: { calories: 1, protein: 0, fat: 0, carbohydrates: 0 },
        },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('POST /pantry/items/food creates a Food with stored grams and nutrients', async () => {
    const owner = await insertPersistedUser(harness.db, {
      email: 'create-food@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Food Creator',
      role: 'owner',
      status: 'active',
    });
    const { rawToken, tokenHash } = generateSessionToken();
    await insertPersistedSession(harness.db, {
      userId: owner.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/pantry/items/food',
        headers: {
          authorization: `Bearer ${rawToken}`,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        payload: {
          name: 'Morning Oats',
          brand: 'Test Mill',
          iconKey: 'food_bowl',
          baseAmount: { value: 50, unit: 'g' },
          nutrients: {
            calories: 190,
            protein: 7,
            fat: 3.5,
            carbohydrates: 32,
          },
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload) as {
        item: { id: string; metadata: Record<string, unknown> };
      };
      const row = await persistedFindPantryItemById(harness.db, body.item.id);
      expect(row).toBeDefined();
      expect(row?.ownerUserId).toBe(owner.id);
      expect(row?.itemType).toBe('food');
      expect(row?.name).toBe('Morning Oats');
      expect(row?.iconKey).toBe('food_bowl');
      const meta = row?.metadata as Record<string, unknown>;
      expect(meta['kind']).toBe('food');
      expect(meta['brand']).toBe('Test Mill');
      expect(meta['baseAmountGrams']).toBe(50);
      expect(meta['nutrients']).toEqual({
        calories: 190,
        protein: 7,
        fat: 3.5,
        carbohydrates: 32,
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/pantry/items?itemType=food',
        headers: { authorization: `Bearer ${rawToken}`, accept: 'application/json' },
      });
      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.payload) as { items: { id: string }[] };
      expect(listBody.items.some((i) => i.id === body.item.id)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('POST /pantry/items/food normalizes ounces to grams at the boundary', async () => {
    const owner = await insertPersistedUser(harness.db, {
      email: 'oz-food@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Oz Owner',
      role: 'owner',
      status: 'active',
    });
    const { rawToken, tokenHash } = generateSessionToken();
    await insertPersistedSession(harness.db, {
      userId: owner.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/pantry/items/food',
        headers: {
          authorization: `Bearer ${rawToken}`,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        payload: {
          name: 'One Oz Snack',
          iconKey: 'food_nut',
          baseAmount: { value: 1, unit: 'oz' },
          nutrients: { calories: 150, protein: 4, fat: 12, carbohydrates: 8 },
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload) as { item: { id: string } };
      const row = await persistedFindPantryItemById(harness.db, body.item.id);
      const meta = row?.metadata as Record<string, unknown>;
      expect(meta?.['baseAmountGrams']).toBe(STORED_GRAMS_FOR_ONE_OUNCE);
    } finally {
      await app.close();
    }
  });

  it('POST /pantry/items/food returns invalid_input for bad iconKey', async () => {
    const owner = await insertPersistedUser(harness.db, {
      email: 'bad-icon@example.com',
      passwordHash: await hashPasswordArgon2id(goodPassword),
      displayName: 'Bad Icon',
      role: 'owner',
      status: 'active',
    });
    const { rawToken, tokenHash } = generateSessionToken();
    await insertPersistedSession(harness.db, {
      userId: owner.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/pantry/items/food',
        headers: {
          authorization: `Bearer ${rawToken}`,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        payload: {
          name: 'X',
          iconKey: 'not_in_catalog',
          baseAmount: { value: 1, unit: 'g' },
          nutrients: { calories: 1, protein: 0, fat: 0, carbohydrates: 0 },
        },
      });
      expect(res.statusCode).toBe(400);
      const err = JSON.parse(res.payload) as { error: string; field: string };
      expect(err.error).toBe('invalid_input');
      expect(err.field).toBe('iconKey');
    } finally {
      await app.close();
    }
  });
});
