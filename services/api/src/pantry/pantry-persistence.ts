import { and, asc, eq, inArray } from 'drizzle-orm';

import type { Database } from '@healthy/db/client';
import {
  nutrients,
  pantryItems,
  recipeIngredients,
  type NewPantryItemRow,
  type PantryItemRow,
} from '@healthy/db/schema';

import type { CreateRecipeIngredientForRow } from './create-recipe-payload.js';

export type PantryItemTypeWire = 'food' | 'recipe';

export async function loadNutrientsCatalog(db: Database) {
  return db.select().from(nutrients).orderBy(asc(nutrients.key));
}

export async function listPantryItemsForOwner(
  db: Database,
  ownerUserId: string,
  itemType: PantryItemTypeWire,
) {
  return db
    .select()
    .from(pantryItems)
    .where(and(eq(pantryItems.ownerUserId, ownerUserId), eq(pantryItems.itemType, itemType)))
    .orderBy(asc(pantryItems.createdAt), asc(pantryItems.id));
}

export async function findPantryItemForOwner(db: Database, ownerUserId: string, itemId: string) {
  const rows = await db
    .select()
    .from(pantryItems)
    .where(and(eq(pantryItems.id, itemId), eq(pantryItems.ownerUserId, ownerUserId)))
    .limit(1);
  return rows[0];
}

export async function findFoodPantryItemsForOwner(
  db: Database,
  ownerUserId: string,
  ids: string[],
): Promise<PantryItemRow[]> {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select()
    .from(pantryItems)
    .where(
      and(
        eq(pantryItems.ownerUserId, ownerUserId),
        eq(pantryItems.itemType, 'food'),
        inArray(pantryItems.id, ids),
      ),
    );
}

/** Loads foods and recipes owned by the user matching ids (create-recipe preload). */
export async function findPantryItemsForOwnerByIds(
  db: Database,
  ownerUserId: string,
  ids: string[],
): Promise<PantryItemRow[]> {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select()
    .from(pantryItems)
    .where(and(eq(pantryItems.ownerUserId, ownerUserId), inArray(pantryItems.id, ids)));
}

export class RecipeIngredientCycleError extends Error {
  readonly code = 'recipe_ingredient_cycle' as const;
  constructor() {
    super('Recipe ingredient would create a circular recipe reference.');
    this.name = 'RecipeIngredientCycleError';
  }
}

/** Recipe-only ingredient edges from `recipePantryItemId` for nested traversal. */
export async function listRecipeChildRecipePantryIds(
  db: Database,
  recipePantryItemId: string,
): Promise<string[]> {
  const rows = await db
    .select({ childId: pantryItems.id })
    .from(recipeIngredients)
    .innerJoin(pantryItems, eq(recipeIngredients.ingredientFoodPantryItemId, pantryItems.id))
    .where(
      and(eq(recipeIngredients.recipePantryItemId, recipePantryItemId), eq(pantryItems.itemType, 'recipe')),
    );
  return rows.map((r) => r.childId);
}

/** True when there is a directed path startRecipeId → … → targetRecipeId following nested recipes only. */
export async function canReachRecipeThroughNestedIngredients(
  db: Database,
  ownerUserId: string,
  startRecipeId: string,
  targetRecipeId: string,
): Promise<boolean> {
  const visited = new Set<string>();

  async function dfs(cur: string): Promise<boolean> {
    if (cur === targetRecipeId) {
      return true;
    }
    if (visited.has(cur)) {
      return false;
    }
    visited.add(cur);

    const ownerRow = await findPantryItemForOwner(db, ownerUserId, cur);
    if (ownerRow === undefined || ownerRow.itemType !== 'recipe') {
      return false;
    }

    const children = await listRecipeChildRecipePantryIds(db, cur);
    for (const c of children) {
      if (await dfs(c)) {
        return true;
      }
    }
    return false;
  }

  return dfs(startRecipeId);
}

export async function insertRecipeWithIngredients(
  db: Database,
  input: Pick<NewPantryItemRow, 'ownerUserId' | 'name' | 'iconKey' | 'metadata'>,
  ingredients: CreateRecipeIngredientForRow[],
): Promise<PantryItemRow> {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(pantryItems)
      .values({
        ownerUserId: input.ownerUserId,
        itemType: 'recipe',
        name: input.name,
        iconKey: input.iconKey,
        metadata: input.metadata,
        updatedAt: now,
      })
      .returning();
    if (row === undefined) {
      throw new Error('insertRecipeWithIngredients did not return a pantry row');
    }
    for (const ing of ingredients) {
      if (ing.ingredientKind === 'recipe') {
        const cyclic = await canReachRecipeThroughNestedIngredients(
          tx,
          input.ownerUserId,
          ing.ingredientFoodPantryItemId,
          row.id,
        );
        if (cyclic) {
          throw new RecipeIngredientCycleError();
        }
      }
    }
    if (ingredients.length > 0) {
      await tx.insert(recipeIngredients).values(
        ingredients.map((ing) => ({
          recipePantryItemId: row.id,
          ingredientFoodPantryItemId: ing.ingredientFoodPantryItemId,
          sortOrder: ing.sortOrder,
          servingKind: ing.servingKind,
          servingUnitKey: ing.servingUnitKey,
          servingCustomLabel: ing.servingCustomLabel,
          quantity: ing.quantity,
        })),
      );
    }
    return row;
  });
}

export async function listRecipeIngredientRowsForRecipe(db: Database, recipePantryItemId: string) {
  return db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipePantryItemId, recipePantryItemId))
    .orderBy(asc(recipeIngredients.sortOrder), asc(recipeIngredients.id));
}

export async function insertOwnedPantryItem(
  db: Database,
  input: Pick<NewPantryItemRow, 'ownerUserId' | 'itemType' | 'name' | 'iconKey' | 'metadata'>,
): Promise<PantryItemRow> {
  const now = new Date();
  const [row] = await db
    .insert(pantryItems)
    .values({
      ...input,
      updatedAt: now,
    })
    .returning();
  if (row === undefined) {
    throw new Error('insertOwnedPantryItem did not return a row');
  }
  return row;
}
