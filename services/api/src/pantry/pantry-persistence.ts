import { and, asc, eq } from 'drizzle-orm';

import type { Database } from '@healthy/db/client';
import { nutrients, pantryItems } from '@healthy/db/schema';

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
