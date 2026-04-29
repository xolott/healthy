import type { FastifyInstance } from 'fastify';

import { createUserRepository } from '@healthy/db';

import { validateFirstOwnerSetupPayload } from '../auth/auth-use-cases.js';
import { createAuthUseCasesForDatabase } from '../auth/auth-use-case-scope.js';

import type { RequestScope } from './types.js';

/**
 * Fastify-backed Request Scope: reads process-owned persistence from `app.databaseAdapter`
 * (registered with env startup) and maps failures to scope outcomes.
 */
export function createRequestScopeForApp(app: FastifyInstance): RequestScope {
  return {
    status: {
      async activeOwnerExists() {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const repo = createUserRepository(adapter.db);
          const hasOwner = await repo.hasActiveOwner();
          return { kind: 'ok', hasActiveOwner: hasOwner };
        } catch (err) {
          app.log.warn({ err }, 'status database lookup failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
    currentSession: {
      async resolveFromRawToken(rawToken: string) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const useCases = createAuthUseCasesForDatabase(adapter.db);
          return await useCases.resolveCurrentSession(rawToken);
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
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const useCases = createAuthUseCasesForDatabase(adapter.db);
          return await useCases.logout(rawToken);
        } catch (err) {
          app.log.warn({ err }, 'logout database operation failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
    ownerLogin: {
      async loginWithEmailPassword(
        rawEmail: string,
        rawPassword: string,
        ctx: { ip: string | null; userAgent: string | null },
      ) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          return { kind: 'persistence_not_configured' };
        }
        try {
          const useCases = createAuthUseCasesForDatabase(adapter.db);
          return await useCases.ownerLogin(rawEmail, rawPassword, ctx);
        } catch (err) {
          app.log.warn({ err }, 'owner login database operation failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
    firstOwnerSetup: {
      async setupFirstOwner(
        rawDisplayName: string,
        rawEmail: string,
        rawPassword: string,
        ctx: { setCookie: boolean; ip: string | null; userAgent: string | null },
      ) {
        const adapter = app.databaseAdapter;
        if (adapter === null) {
          const pre = validateFirstOwnerSetupPayload(rawDisplayName, rawEmail, rawPassword);
          if (pre.kind !== 'ok') {
            return pre;
          }
          return { kind: 'persistence_not_configured' };
        }
        try {
          const useCases = createAuthUseCasesForDatabase(adapter.db);
          return await useCases.firstOwnerSetup(rawDisplayName, rawEmail, rawPassword, ctx);
        } catch (err) {
          app.log.warn({ err }, 'first owner setup database operation failed');
          return { kind: 'persistence_unavailable' };
        }
      },
    },
  };
}
