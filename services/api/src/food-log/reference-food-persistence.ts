import { inArray } from 'drizzle-orm';

import type { Database } from '@healthy/db/client';
import { referenceFoods, type ReferenceFoodRow } from '@healthy/db/schema';

export async function findReferenceFoodsByIds(db: Database, ids: string[]): Promise<ReferenceFoodRow[]> {
  if (ids.length === 0) {
    return [];
  }
  return db.select().from(referenceFoods).where(inArray(referenceFoods.id, ids));
}
