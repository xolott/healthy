import type { FastifyInstance } from 'fastify';

import { withDisposableDatabase, type Database } from '@healthy/db';

import { createDrizzleAuthPersistence } from './auth-persistence.js';
import { createAuthUseCases, type ResolveCurrentSessionResult } from './auth-use-cases.js';

/**
 * Outcome of resolving the current session for GET /auth/me, including configuration checks.
 */
export type AuthMeFromAppRequestOutcome =
  | { kind: 'service_unavailable' }
  | ResolveCurrentSessionResult;

/**
 * Returns a trimmed database URL when the app is configured for auth database access.
 */
export function getAuthDatabaseUrl(app: FastifyInstance): string | undefined {
  const url = app.config.DATABASE_URL?.trim();
  if (url === undefined || url === '') {
    return undefined;
  }
  return url;
}

/**
 * Builds Auth Use Cases backed by Drizzle persistence on an existing database handle
 * (for adapter integration tests and non-request callers).
 */
export function createAuthUseCasesForDatabase(
  db: Database,
  clock: () => Date = () => new Date(),
) {
  const persistence = createDrizzleAuthPersistence(db);
  return createAuthUseCases({ persistence, clock });
}

/**
 * Resolves the current session using app configuration: disposable DB connection,
 * factory-created Auth Use Cases, and Drizzle-backed persistence.
 */
export async function resolveAuthMeFromAppRequest(
  app: FastifyInstance,
  rawToken: string,
): Promise<AuthMeFromAppRequestOutcome> {
  const url = getAuthDatabaseUrl(app);
  if (url === undefined) {
    return { kind: 'service_unavailable' };
  }

  return withDisposableDatabase(url, async (db) => {
    const useCases = createAuthUseCasesForDatabase(db);
    return useCases.resolveCurrentSession(rawToken);
  });
}
