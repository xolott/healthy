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
