import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

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
