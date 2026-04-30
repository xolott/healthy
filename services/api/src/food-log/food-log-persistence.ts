import { and, asc, eq, isNull } from 'drizzle-orm';

import type { Database } from '@healthy/db/client';
import { foodLogEntries, type FoodLogEntryRow, type NewFoodLogEntryRow } from '@healthy/db/schema';

/**
 * Reads day-scoped Food Log Entries for summaries and timelines.
 *
 * **Invariant:** Rows with `deleted_at` set are excluded; when soft-delete exists,
 * day views and totals must not surface tombstoned entries.
 */
export async function listFoodLogEntriesForOwnerDate(
  db: Database,
  ownerUserId: string,
  consumedDate: string,
): Promise<FoodLogEntryRow[]> {
  return db
    .select()
    .from(foodLogEntries)
    .where(
      and(
        eq(foodLogEntries.ownerUserId, ownerUserId),
        eq(foodLogEntries.consumedDate, consumedDate),
        isNull(foodLogEntries.deletedAt),
      ),
    )
    .orderBy(asc(foodLogEntries.consumedAt), asc(foodLogEntries.id));
}

export async function insertFoodLogEntries(
  db: Database,
  rows: NewFoodLogEntryRow[],
): Promise<FoodLogEntryRow[]> {
  if (rows.length === 0) {
    return [];
  }
  return db.transaction(async (tx) => tx.insert(foodLogEntries).values(rows).returning());
}
