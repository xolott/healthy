import type { FastifyInstance } from 'fastify';

import { withDisposableDatabase, type Database } from '@healthy/db';

import { createDrizzleAuthPersistence } from './auth-persistence.js';
import {
  createAuthUseCases,
  type OwnerLoginResult,
  type ResolveCurrentSessionResult,
} from './auth-use-cases.js';
import { verifyPasswordArgon2id } from './hash-password.js';
import { generateSessionToken } from './session-token.js';

/**
 * Outcome of resolving the current session for GET /auth/me, including configuration checks.
 */
export type AuthMeFromAppRequestOutcome =
  | { kind: 'service_unavailable' }
  | ResolveCurrentSessionResult;

/**
 * Owner login from app configuration (database URL check + disposable connection).
 */
export type OwnerLoginFromAppRequestOutcome =
  | { kind: 'service_unavailable' }
  | OwnerLoginResult;

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
  overrides?: {
    clock?: () => Date;
    verifyPassword?: (plain: string, storedHash: string) => Promise<boolean>;
    generateSessionToken?: () => { rawToken: string; tokenHash: string };
  },
) {
  return createAuthUseCases({
    persistence: createDrizzleAuthPersistence(db),
    clock: overrides?.clock ?? (() => new Date()),
    verifyPassword: overrides?.verifyPassword ?? verifyPasswordArgon2id,
    generateSessionToken: overrides?.generateSessionToken ?? generateSessionToken,
  });
}

/**
 * Runs owner email/password login using app configuration: disposable DB connection
 * and factory-created Auth Use Cases.
 */
export async function ownerLoginFromAppRequest(
  app: FastifyInstance,
  rawEmail: string,
  rawPassword: string,
  ctx: { ip: string | null; userAgent: string | null },
): Promise<OwnerLoginFromAppRequestOutcome> {
  const url = getAuthDatabaseUrl(app);
  if (url === undefined) {
    return { kind: 'service_unavailable' };
  }

  return withDisposableDatabase(url, async (db) => {
    const useCases = createAuthUseCasesForDatabase(db);
    return useCases.ownerLogin(rawEmail, rawPassword, ctx);
  });
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
