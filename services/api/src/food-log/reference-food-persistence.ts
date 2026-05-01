import { eq, inArray } from 'drizzle-orm';

import type { Database } from '@healthy/db/client';
import { referenceFoods, type ReferenceFoodRow } from '@healthy/db/schema';

export async function findReferenceFoodsByIds(db: Database, ids: string[]): Promise<ReferenceFoodRow[]> {
  if (ids.length === 0) {
    return [];
  }
  return db.select().from(referenceFoods).where(inArray(referenceFoods.id, ids));
}

export async function findReferenceFoodById(db: Database, id: string): Promise<ReferenceFoodRow | undefined> {
  const [row] = await db.select().from(referenceFoods).where(eq(referenceFoods.id, id)).limit(1);
  return row;
}
