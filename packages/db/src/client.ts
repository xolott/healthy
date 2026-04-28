import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { schema } from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Creates a typed Drizzle instance over a `postgres.js` client.
 * The caller owns connection lifecycle; close the client when shutting down.
 */
export function createDb(
  connectionString: string,
  options?: NonNullable<Parameters<typeof postgres>[1]>,
): Database {
  const client = postgres(connectionString, options);
  return drizzle({ client, schema });
}

/** Single short-lived connection; ends the client after `fn` completes. */
export async function withDisposableDatabase<T>(
  connectionString: string,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  const client = postgres(connectionString, { max: 1 });
  try {
    return await fn(drizzle({ client, schema }));
  } finally {
    await client.end({ timeout: 5 });
  }
}
