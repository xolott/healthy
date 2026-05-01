import { createHash } from 'node:crypto';

import { sql } from 'drizzle-orm';

import type { Database } from '@healthy/db/client';

/** Stable two-int keys for `pg_try_advisory_lock` scoped by catalog source. */
export function advisoryLockIntsForReferenceFoodSource(source: string): readonly [number, number] {
  const buf = createHash('sha256').update(source, 'utf8').digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}

export async function tryAcquireReferenceFoodImportLock(
  db: Database,
  keys: readonly [number, number],
): Promise<boolean> {
  const [k1, k2] = keys;
  const rows = await db.execute<{ locked: boolean }>(
    sql`select pg_try_advisory_lock(${k1}::integer, ${k2}::integer) as locked`,
  );
  const row = rows[0] as { locked: boolean } | undefined;
  return row?.locked === true;
}

export async function releaseReferenceFoodImportLock(
  db: Database,
  keys: readonly [number, number],
): Promise<void> {
  const [k1, k2] = keys;
  await db.execute(sql`select pg_advisory_unlock(${k1}::integer, ${k2}::integer)`);
}
