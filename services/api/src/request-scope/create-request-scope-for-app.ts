import type { FastifyInstance } from 'fastify';

import { createUserRepository, withDisposableDatabase } from '@healthy/db';

import { createAuthUseCasesForDatabase } from '../auth/auth-use-case-scope.js';

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
    currentSession: {
      async resolveFromRawToken(rawToken: string) {
        const url = app.config.DATABASE_URL?.trim();
        if (url === undefined || url === '') {
          return { kind: 'persistence_not_configured' };
        }
        try {
          return await withDisposableDatabase(url, async (db) => {
            const useCases = createAuthUseCasesForDatabase(db);
            return useCases.resolveCurrentSession(rawToken);
          });
        } catch (err) {
          app.log.warn({ err }, 'current session database lookup failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
    logout: {
      async logoutWithRawToken(rawToken: string | undefined) {
        if (rawToken === undefined || rawToken.length === 0) {
          return { kind: 'skipped', reason: 'no_raw_token' };
        }
        const url = app.config.DATABASE_URL?.trim();
        if (url === undefined || url === '') {
          return { kind: 'persistence_not_configured' };
        }
        try {
          return await withDisposableDatabase(url, async (db) => {
            const useCases = createAuthUseCasesForDatabase(db);
            return useCases.logout(rawToken);
          });
        } catch (err) {
          app.log.warn({ err }, 'logout database operation failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
  };
}
