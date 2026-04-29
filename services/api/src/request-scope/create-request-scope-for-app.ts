import type { FastifyInstance } from 'fastify';

import { inArray } from 'drizzle-orm';

import { validateFirstOwnerSetupPayload } from '../auth/auth-use-cases.js';
import { createAuthUseCasesForDatabase } from '../auth/auth-use-case-scope.js';
import { PANTRY_ICON_KEYS } from '../pantry/pantry-icon-keys.js';
import {
  extractUniqueFoodIdsFromRecipeBody,
  planCreateRecipe,
} from '../pantry/create-recipe-payload.js';
import { parseCreateFoodPayload } from '../pantry/create-food-payload.js';
import {
  findFoodPantryItemsForOwner,
  findPantryItemForOwner,
  insertOwnedPantryItem,
  insertRecipeWithIngredients,
  listRecipeIngredientRowsForRecipe,
  loadNutrientsCatalog,
  listPantryItemsForOwner,
} from '../pantry/pantry-persistence.js';
import { PREDEFINED_SERVING_UNIT_ENTRIES } from '../pantry/predefined-serving-units.js';

import type { Database } from '@healthy/db/client';
import { pantryItems, type PantryItemRow, type RecipeIngredientRow } from '@healthy/db/schema';

import type {
  PantryItemDetailWire,
  PantryItemWire,
  RecipeIngredientWire,
  RequestScope,
} from './types.js';

function mapPantryRowToWire(row: PantryItemRow): PantryItemWire {
  return {
    id: row.id,
    itemType: row.itemType,
    name: row.name,
    iconKey: row.iconKey,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function servingOptionFromPersistedRow(r: RecipeIngredientRow): RecipeIngredientWire['servingOption'] {
  if (r.servingKind === 'base') {
    return { kind: 'base' };
  }
  if (r.servingKind === 'unit') {
    return { kind: 'unit', unit: r.servingUnitKey ?? '' };
  }
  return { kind: 'custom', label: r.servingCustomLabel ?? '' };
}

async function loadRecipeIngredientsWire(
  db: Database,
  recipePantryItemId: string,
): Promise<RecipeIngredientWire[]> {
  const ingRows = await listRecipeIngredientRowsForRecipe(db, recipePantryItemId);
  if (ingRows.length === 0) {
    return [];
  }
  const foodIds = [...new Set(ingRows.map((r) => r.ingredientFoodPantryItemId))];
  const foodRows = await db
    .select({ id: pantryItems.id, name: pantryItems.name })
    .from(pantryItems)
    .where(inArray(pantryItems.id, foodIds));
  const nameById = new Map(foodRows.map((f) => [f.id, f.name]));
  return ingRows.map((r) => ({
    foodId: r.ingredientFoodPantryItemId,
    foodName: nameById.get(r.ingredientFoodPantryItemId) ?? 'Food',
    quantity: r.quantity,
    servingOption: servingOptionFromPersistedRow(r),
  }));
}

/**
 * Fastify-backed Request Scope: reads process-owned persistence from `app.databaseAdapter`
 * (registered with env startup) and maps failures to scope outcomes.
 */
export function createRequestScopeForApp(app: FastifyInstance): RequestScope {
  return {
    status: {
      async isFirstOwnerSetupRequired() {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const useCases = createAuthUseCasesForDatabase(adapter.db);
          const required = await useCases.isFirstOwnerSetupRequired();
          return { kind: 'ok', isFirstOwnerSetupRequired: required };
        } catch (err) {
          app.log.warn({ err }, 'status database lookup failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
    currentSession: {
      async resolveFromRawToken(rawToken: string) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const useCases = createAuthUseCasesForDatabase(adapter.db);
          return await useCases.resolveCurrentSession(rawToken);
        } catch (err) {
          app.log.warn({ err }, 'current session database lookup failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
    logout: {
      async logoutWithRawToken(rawToken: string | undefined) {
        if (rawToken === undefined || rawToken.length === 0) {
          return { kind: 'skipped', reason: 'no_raw_token' };
        }
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const useCases = createAuthUseCasesForDatabase(adapter.db);
          return await useCases.logout(rawToken);
        } catch (err) {
          app.log.warn({ err }, 'logout database operation failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
    ownerLogin: {
      async loginWithEmailPassword(
        rawEmail: string,
        rawPassword: string,
        ctx: { ip: string | null; userAgent: string | null },
      ) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const useCases = createAuthUseCasesForDatabase(adapter.db);
          return await useCases.ownerLogin(rawEmail, rawPassword, ctx);
        } catch (err) {
          app.log.warn({ err }, 'owner login database operation failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
    firstOwnerSetup: {
      async setupFirstOwner(
        rawDisplayName: string,
        rawEmail: string,
        rawPassword: string,
        ctx: { setCookie: boolean; ip: string | null; userAgent: string | null },
      ) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          const pre = validateFirstOwnerSetupPayload(rawDisplayName, rawEmail, rawPassword);
          if (pre.kind !== 'ok') {
            return pre;
          }
          return { kind: 'persistence_not_configured' };
        }
        try {
          const useCases = createAuthUseCasesForDatabase(adapter.db);
          return await useCases.firstOwnerSetup(rawDisplayName, rawEmail, rawPassword, ctx);
        } catch (err) {
          app.log.warn({ err }, 'first owner setup database operation failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
    pantry: {
      async listItemsForOwner(ownerUserId: string, itemType: 'food' | 'recipe') {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const rows = await listPantryItemsForOwner(adapter.db, ownerUserId, itemType);
          return { kind: 'ok', items: rows.map(mapPantryRowToWire) };
        } catch (err) {
          app.log.warn({ err }, 'pantry list lookup failed');
          return { kind: 'persistence_unavailable' };
        }
      },

      async getItemForOwner(ownerUserId: string, itemId: string) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const row = await findPantryItemForOwner(adapter.db, ownerUserId, itemId);
          if (row === undefined) {
            return { kind: 'not_found' };
          }
          const base: PantryItemDetailWire = mapPantryRowToWire(row);
          if (row.itemType !== 'recipe') {
            return { kind: 'ok', item: base };
          }
          const ingredients = await loadRecipeIngredientsWire(adapter.db, row.id);
          return { kind: 'ok', item: { ...base, ingredients } };
        } catch (err) {
          app.log.warn({ err }, 'pantry item lookup failed');
          return { kind: 'persistence_unavailable' };
        }
      },

      async getReferenceCatalog() {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const rows = await loadNutrientsCatalog(adapter.db);
          return {
            kind: 'ok',
            nutrients: rows.map((n) => ({
              key: n.key,
              displayName: n.displayName,
              canonicalUnit: n.canonicalUnit,
            })),
            iconKeys: PANTRY_ICON_KEYS,
            servingUnits: [...PREDEFINED_SERVING_UNIT_ENTRIES],
          };
        } catch (err) {
          app.log.warn({ err }, 'pantry nutrient catalog lookup failed');
          return { kind: 'persistence_unavailable' };
        }
      },

      async createFoodForOwner(ownerUserId: string, rawBody: unknown) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        const parsed = parseCreateFoodPayload(rawBody);
        if (parsed.kind === 'invalid_input') {
          return parsed;
        }
        try {
          const row = await insertOwnedPantryItem(adapter.db, {
            ownerUserId,
            itemType: 'food',
            name: parsed.value.name,
            iconKey: parsed.value.iconKey,
            metadata: parsed.value.metadata as Record<string, unknown>,
          });
          return { kind: 'ok', item: mapPantryRowToWire(row) };
        } catch (err) {
          app.log.warn({ err }, 'pantry create food failed');
          return { kind: 'persistence_unavailable' };
        }
      },

      async createRecipeForOwner(ownerUserId: string, rawBody: unknown) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        const foodIds = extractUniqueFoodIdsFromRecipeBody(rawBody);
        if (foodIds === null) {
          return {
            kind: 'invalid_input',
            field: 'ingredients',
            message: 'Invalid or missing ingredients list.',
          };
        }
        try {
          const rows = await findFoodPantryItemsForOwner(adapter.db, ownerUserId, foodIds);
          const map = new Map(rows.map((r) => [r.id, r]));
          const planned = planCreateRecipe(rawBody, map);
          if (planned.kind === 'invalid_input') {
            return planned;
          }
          const v = planned.value;
          const row = await insertRecipeWithIngredients(adapter.db, {
            ownerUserId,
            name: v.name,
            iconKey: v.iconKey,
            metadata: v.metadata as Record<string, unknown>,
          }, v.ingredients);
          const base = mapPantryRowToWire(row);
          const ingredients = await loadRecipeIngredientsWire(adapter.db, row.id);
          return { kind: 'ok', item: { ...base, ingredients } };
        } catch (err) {
          app.log.warn({ err }, 'pantry create recipe failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
  };
}
