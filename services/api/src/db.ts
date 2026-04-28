import type { FastifyInstance } from 'fastify';

import { createDb, type Database } from '@healthy/db';

export { createDb, type Database } from '@healthy/db';

/**
 * Opens a typed Drizzle client using `app.config.DATABASE_URL`.
 * Call only when persistence is required; missing URL throws a clear error.
 */
export function createDatabaseFromConfig(app: FastifyInstance): Database {
  const url = app.config.DATABASE_URL;
  if (url === undefined || url.trim() === '') {
    throw new Error(
      'DATABASE_URL is required when opening a database connection. Set it in the environment or .env file.',
    );
  }
  return createDb(url);
}
