import type { FastifyInstance } from 'fastify';

import { createDatabaseAdapter, type DatabaseAdapter } from '@healthy/db';

/**
 * When `DATABASE_URL` is set and non-empty after trim, creates one process-owned
 * adapter and registers {@link DatabaseAdapter.close} on Fastify `onClose`.
 * No startup connectivity query; failures surface on first use.
 */
export function registerDatabaseAdapter(app: FastifyInstance): void {
  const url = app.config.DATABASE_URL?.trim();
  if (url === undefined || url === '') {
    app.decorate('databaseAdapter', null as DatabaseAdapter | null);
    return;
  }

  const adapter = createDatabaseAdapter(url);
  app.decorate('databaseAdapter', adapter);
  app.addHook('onClose', async () => {
    await adapter.close();
  });
}
