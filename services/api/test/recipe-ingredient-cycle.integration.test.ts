import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { users, recipeIngredients, pantryItems } from '@healthy/db/schema';

import { hashPasswordArgon2id } from '../src/auth/hash-password.js';
import { canReachRecipeThroughNestedIngredients } from '../src/pantry/pantry-persistence.js';
import { insertPersistedPantryItem, insertPersistedUser } from './helpers/persisted-builders.js';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';

const minimalRecipeMeta = {
  kind: 'recipe' as const,
  servings: 1,
  servingLabel: 'serving',
  nutrients: { calories: 10, protein: 1, fat: 0, carbohydrates: 1 },
  nutrientsPerServing: { calories: 10, protein: 1, fat: 0, carbohydrates: 1 },
};

describe('nested recipe ingredient graph', () => {
  let harness: PostgresTestDatabase;

  beforeAll(async () => {
    harness = await startPostgresTestDatabase();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  beforeEach(async () => {
    await harness.db.delete(recipeIngredients);
    await harness.db.delete(pantryItems);
    await harness.db.delete(users);
    vi.stubEnv('DATABASE_URL', harness.connectionUri);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('canReachRecipeThroughNestedIngredients follows recipe-only ingredient edges', async () => {
    const owner = await insertPersistedUser(harness.db, {
      email: 'cycle-graph@example.com',
      passwordHash: await hashPasswordArgon2id('goodpassword12'),
      displayName: 'Owner',
      role: 'owner',
      status: 'active',
    });
    const ra = await insertPersistedPantryItem(harness.db, {
      ownerUserId: owner.id,
      itemType: 'recipe',
      name: 'A',
      iconKey: 'recipe_pot',
      metadata: minimalRecipeMeta as unknown as Record<string, unknown>,
    });
    const rb = await insertPersistedPantryItem(harness.db, {
      ownerUserId: owner.id,
      itemType: 'recipe',
      name: 'B',
      iconKey: 'recipe_pot',
      metadata: minimalRecipeMeta as unknown as Record<string, unknown>,
    });
    const rc = await insertPersistedPantryItem(harness.db, {
      ownerUserId: owner.id,
      itemType: 'recipe',
      name: 'C',
      iconKey: 'recipe_pot',
      metadata: minimalRecipeMeta as unknown as Record<string, unknown>,
    });

    await harness.db.insert(recipeIngredients).values({
      recipePantryItemId: ra.id,
      ingredientFoodPantryItemId: rb.id,
      sortOrder: 0,
      servingKind: 'base',
      servingUnitKey: null,
      servingCustomLabel: null,
      quantity: 1,
    });
    await harness.db.insert(recipeIngredients).values({
      recipePantryItemId: rb.id,
      ingredientFoodPantryItemId: rc.id,
      sortOrder: 0,
      servingKind: 'base',
      servingUnitKey: null,
      servingCustomLabel: null,
      quantity: 1,
    });

    await expect(
      canReachRecipeThroughNestedIngredients(harness.db, owner.id, ra.id, rb.id),
    ).resolves.toBe(true);
    await expect(
      canReachRecipeThroughNestedIngredients(harness.db, owner.id, ra.id, rc.id),
    ).resolves.toBe(true);
    await expect(
      canReachRecipeThroughNestedIngredients(harness.db, owner.id, rc.id, ra.id),
    ).resolves.toBe(false);
  });

  it('canReachRecipeThroughNestedIngredients detects self-reference (cycle guard primitive)', async () => {
    const owner = await insertPersistedUser(harness.db, {
      email: 'cycle-self@example.com',
      passwordHash: await hashPasswordArgon2id('goodpassword12'),
      displayName: 'Owner',
      role: 'owner',
      status: 'active',
    });
    const ra = await insertPersistedPantryItem(harness.db, {
      ownerUserId: owner.id,
      itemType: 'recipe',
      name: 'Solo',
      iconKey: 'recipe_pot',
      metadata: minimalRecipeMeta as unknown as Record<string, unknown>,
    });
    await expect(
      canReachRecipeThroughNestedIngredients(harness.db, owner.id, ra.id, ra.id),
    ).resolves.toBe(true);
  });
});
