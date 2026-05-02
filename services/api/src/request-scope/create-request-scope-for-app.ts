import type { FastifyInstance } from 'fastify';

import { inArray } from 'drizzle-orm';

import { validateFirstOwnerSetupPayload } from '../auth/auth-use-cases.js';
import { createAuthUseCasesForDatabase } from '../auth/auth-use-case-scope.js';
import { PANTRY_ICON_KEYS } from '../pantry/pantry-icon-keys.js';
import {
  extractIngredientPantryIdsFromRecipeBody,
  planCreateRecipe,
} from '../pantry/create-recipe-payload.js';
import { parseCreateFoodPayload } from '../pantry/create-food-payload.js';
import {
  RecipeIngredientCycleError,
  findPantryItemsForOwnerByIds,
  findPantryItemForOwner,
  insertOwnedPantryItem,
  insertRecipeWithIngredients,
  listRecipeIngredientRowsForRecipe,
  loadNutrientsCatalog,
  listPantryItemsForOwner,
} from '../pantry/pantry-persistence.js';
import { insertFoodLogEntries, listFoodLogEntriesForOwnerDate } from '../food-log/food-log-persistence.js';
import {
  collectFoodLogBatchResolutionIds,
  planFoodLogBatch,
} from '../food-log/plan-food-log-batch.js';
import {
  findReferenceFoodById,
  findReferenceFoodsByIds,
} from '../food-log/reference-food-persistence.js';
import {
  mapOrderedIdsToSearchCards,
  referenceFoodRowToDetailWire,
} from '../reference-food/reference-food-public-wire.js';
import { createElasticsearchClientFromEnv } from '../reference-food/search/create-elasticsearch-client.js';
import { REFERENCE_FOOD_SEARCH_ALIAS_DEFAULT } from '../reference-food/search/reference-food-search-document.js';
import { searchReferenceFoodIdsOrdered } from '../reference-food/search/search-reference-food-ids.js';
import { PREDEFINED_SERVING_UNIT_ENTRIES } from '../pantry/predefined-serving-units.js';

import type { Database } from '@healthy/db/client';
import {
  pantryItems,
  type FoodLogEntryRow,
  type PantryItemRow,
  type RecipeIngredientRow,
} from '@healthy/db/schema';

import type {
  FoodLogEntryServingWire,
  FoodLogEntryWire,
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

function servingOptionFoodLogWireFromPersisted(row: FoodLogEntryRow): FoodLogEntryServingWire {
  if (row.servingKind === 'base') {
    return { kind: 'base' };
  }
  if (row.servingKind === 'unit') {
    return { kind: 'unit', unit: row.servingUnitKey ?? '' };
  }
  return { kind: 'custom', label: row.servingCustomLabel ?? '' };
}

function mapFoodLogRowToWire(row: FoodLogEntryRow): FoodLogEntryWire {
  if (row.itemSource === 'reference_food') {
    return {
      id: row.id,
      itemSource: 'reference_food',
      referenceFoodId: row.referenceFoodId ?? undefined,
      referenceFoodSource: row.referenceFoodSource ?? undefined,
      referenceSourceFoodId: row.referenceSourceFoodId ?? undefined,
      displayName: row.displayName,
      iconKey: row.iconKey,
      calories: row.calories,
      proteinGrams: row.proteinGrams,
      fatGrams: row.fatGrams,
      carbohydratesGrams: row.carbohydratesGrams,
      consumedAt: row.consumedAt.toISOString(),
      consumedDate: row.consumedDate,
      quantity: row.quantity,
      servingOption: servingOptionFoodLogWireFromPersisted(row),
    };
  }
  return {
    id: row.id,
    itemSource: 'pantry',
    pantryItemId: row.pantryItemId ?? '',
    displayName: row.displayName,
    iconKey: row.iconKey,
    calories: row.calories,
    proteinGrams: row.proteinGrams,
    fatGrams: row.fatGrams,
    carbohydratesGrams: row.carbohydratesGrams,
    consumedAt: row.consumedAt.toISOString(),
    consumedDate: row.consumedDate,
    quantity: row.quantity,
    servingOption: servingOptionFoodLogWireFromPersisted(row),
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
  const pantryIds = [...new Set(ingRows.map((r) => r.ingredientFoodPantryItemId))];
  const pantryRows = await db
    .select({ id: pantryItems.id, name: pantryItems.name, itemType: pantryItems.itemType })
    .from(pantryItems)
    .where(inArray(pantryItems.id, pantryIds));
  const metaById = new Map(pantryRows.map((p) => [p.id, p]));
  return ingRows.map((r) => {
    const p = metaById.get(r.ingredientFoodPantryItemId);
    const ingredientKind = p?.itemType === 'recipe' ? 'recipe' : 'food';
    return {
      ingredientKind,
      pantryItemId: r.ingredientFoodPantryItemId,
      displayName: p?.name ?? 'Ingredient',
      quantity: r.quantity,
      servingOption: servingOptionFromPersistedRow(r),
    };
  });
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
        const pantryIds = extractIngredientPantryIdsFromRecipeBody(rawBody);
        if (pantryIds === null) {
          return {
            kind: 'invalid_input',
            field: 'ingredients',
            message: 'Invalid or missing ingredients list.',
          };
        }
        try {
          const rows = await findPantryItemsForOwnerByIds(adapter.db, ownerUserId, pantryIds);
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
          if (err instanceof RecipeIngredientCycleError) {
            return {
              kind: 'invalid_input',
              field: 'ingredients',
              message: err.message,
            };
          }
          app.log.warn({ err }, 'pantry create recipe failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
    foodLog: {
      async listEntriesForOwnerOnLocalDate(ownerUserId: string, consumedDate: string) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const rows = await listFoodLogEntriesForOwnerDate(adapter.db, ownerUserId, consumedDate);
          return { kind: 'ok', entries: rows.map(mapFoodLogRowToWire) };
        } catch (err) {
          app.log.warn({ err }, 'food log list failed');
          return { kind: 'persistence_unavailable' };
        }
      },

      async createEntriesBatchForOwner(ownerUserId: string, rawBody: unknown) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        const idsRes = collectFoodLogBatchResolutionIds(rawBody);
        if (idsRes.kind === 'invalid_input') {
          return {
            kind: 'invalid_input',
            field: idsRes.field,
            message: idsRes.message,
          };
        }
        try {
          const pantryRows = await findPantryItemsForOwnerByIds(adapter.db, ownerUserId, idsRes.pantryIds);
          const pantryMap = new Map(pantryRows.map((r) => [r.id, r]));
          for (const id of idsRes.pantryIds) {
            if (!pantryMap.has(id)) {
              return {
                kind: 'invalid_input',
                field: 'entries',
                message: 'One or more Pantry items were not found for this owner.',
              };
            }
          }
          const referenceRows = await findReferenceFoodsByIds(adapter.db, idsRes.referenceIds);
          const referenceMap = new Map(referenceRows.map((r) => [r.id, r]));
          for (const id of idsRes.referenceIds) {
            const rf = referenceMap.get(id);
            if (rf === undefined) {
              return {
                kind: 'invalid_input',
                field: 'entries',
                message: 'One or more Reference Food identifiers were not found.',
              };
            }
            if (!rf.isActive) {
              return {
                kind: 'invalid_input',
                field: 'entries',
                message: 'One or more Reference Foods are inactive and cannot be logged.',
              };
            }
          }
          const planned = planFoodLogBatch(ownerUserId, rawBody, pantryMap, referenceMap, new Date());
          if (planned.kind === 'invalid_input') {
            return planned;
          }
          const inserted = await insertFoodLogEntries(adapter.db, planned.rows);
          return { kind: 'ok', entries: inserted.map(mapFoodLogRowToWire) };
        } catch (err) {
          app.log.warn({ err }, 'food log batch create failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
    referenceFood: {
      async searchActive(_ownerUserId: string, query: { q?: unknown; limit?: unknown }) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        const qRaw = query.q;
        const q =
          typeof qRaw === 'string'
            ? qRaw.trim()
            : qRaw !== undefined && qRaw !== null
              ? String(qRaw).trim()
              : '';
        if (q.length < 2) {
          return {
            kind: 'invalid_input',
            field: 'q',
            message: 'Search text must be at least 2 characters.',
          };
        }
        if (q.length > 200) {
          return {
            kind: 'invalid_input',
            field: 'q',
            message: 'Search text is too long.',
          };
        }
        let limit = 25;
        const limitRaw = query.limit;
        if (limitRaw !== undefined && limitRaw !== null && String(limitRaw).length > 0) {
          const n = typeof limitRaw === 'number' ? limitRaw : Number(String(limitRaw));
          if (!Number.isFinite(n) || n < 1 || n > 50) {
            return {
              kind: 'invalid_input',
              field: 'limit',
              message: 'Limit must be between 1 and 50.',
            };
          }
          limit = Math.floor(n);
        }

        const esUrl = process.env.ELASTICSEARCH_URL?.trim();

        if (esUrl === undefined || esUrl.length === 0) {
          app.log.warn(
            {
              referenceFoodSearchFailure: 'search_unavailable',
              cause: 'elasticsearch_url_not_configured',
            },
            'reference food search failed',
          );
          return { kind: 'search_unavailable' };
        }

        try {
          const client = createElasticsearchClientFromEnv();
          const orderedIds = await searchReferenceFoodIdsOrdered(
            client,
            REFERENCE_FOOD_SEARCH_ALIAS_DEFAULT,
            q,
            limit,
          );
          const rows = await findReferenceFoodsByIds(adapter.db, orderedIds);
          const byId = new Map(rows.map((r) => [r.id, r]));
          const items = mapOrderedIdsToSearchCards(orderedIds, byId);
          return { kind: 'ok', items };
        } catch (err) {
          app.log.warn(
            {
              err,
              referenceFoodSearchFailure: 'search_unavailable',
              cause: 'elasticsearch_search_error',
            },
            'reference food elasticsearch search failed',
          );
          return { kind: 'search_unavailable' };
        }
      },

      async getActiveDetail(_ownerUserId: string, id: string) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const row = await findReferenceFoodById(adapter.db, id);
          if (row === undefined || !row.isActive) {
            return { kind: 'not_found' };
          }
          return { kind: 'ok', food: referenceFoodRowToDetailWire(row) };
        } catch (err) {
          app.log.warn({ err }, 'reference food detail lookup failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
  };
}
