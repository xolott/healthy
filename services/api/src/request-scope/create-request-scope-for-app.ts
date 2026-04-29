import type { FastifyInstance } from 'fastify';

import { createUserRepository, withDisposableDatabase } from '@healthy/db';

import type { RequestScope } from './types.js';

/**
 * Fastify-backed Request Scope: reads persistence configuration from the app,
 * runs disposable-database status reads, and maps failures to scope outcomes.
 */
export function createRequestScopeForApp(app: FastifyInstance): RequestScope {
  return {
    status: {
      async activeOwnerExists() {
        const url = app.config.DATABASE_URL?.trim();
        if (url === undefined || url === '') {
          return { kind: 'persistence_not_configured' };
        }
        try {
          return await withDisposableDatabase(url, async (db) => {
            const repo = createUserRepository(db);
            const hasOwner = await repo.hasActiveOwner();
            return { kind: 'ok', hasActiveOwner: hasOwner };
          });
        } catch (err) {
          app.log.warn({ err }, 'status database lookup failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
  };
}
