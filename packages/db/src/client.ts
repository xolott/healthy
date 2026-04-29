import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { schema } from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Process-owned database access: typed Drizzle handle plus explicit shutdown
 * for the underlying PostgreSQL client. Prefer this over `createDb` when the
 * caller must release connections (e.g. app lifecycle).
 */
export interface DatabaseAdapter {
  readonly db: Database;
  close(): Promise<void>;
}

function createOwnedDatabase(
  connectionString: string,
  options?: NonNullable<Parameters<typeof postgres>[1]>,
): { db: Database; close: () => Promise<void> } {
  const client = postgres(connectionString, options);
  const db = drizzle({ client, schema });
  return {
    db,
    async close() {
      await client.end({ timeout: 5 });
    },
  };
}

/**
 * Opens a typed Drizzle database and pairs it with {@link DatabaseAdapter.close}
 * for clean process shutdown. Client and Drizzle wiring stay inside this package.
 */
export function createDatabaseAdapter(
  connectionString: string,
  options?: NonNullable<Parameters<typeof postgres>[1]>,
): DatabaseAdapter {
  return createOwnedDatabase(connectionString, options);
}

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
  const { db, close } = createOwnedDatabase(connectionString, { max: 1 });
  try {
    return await fn(db);
  } finally {
    await close();
  }
}
