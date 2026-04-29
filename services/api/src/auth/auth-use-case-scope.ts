/**
 * Auth Use Case Scope: request-level wiring that opens disposable database connections,
 * checks configuration, and builds Auth Use Cases via `createAuthUseCasesForDatabase`.
 * Routes and HTTP integration tests depend on this module instead of reaching into
 * `auth-use-cases` or `auth-persistence` directly.
 */
import type { FastifyInstance } from 'fastify';

import { withDisposableDatabase, type Database } from '@healthy/db';

import { createDrizzleAuthPersistence } from './auth-persistence.js';
import {
  createAuthUseCases,
  type OwnerLoginResult,
  validateFirstOwnerSetupPayload,
  type FirstOwnerSetupResult,
  type LogoutResult,
} from './auth-use-cases.js';
import { hashPasswordArgon2id, verifyPasswordArgon2id } from './hash-password.js';
import { generateSessionToken } from './session-token.js';

export type { AuthMeUser } from './auth-use-cases.js';

/**
 * Owner login from app configuration (database URL check + disposable connection).
 */
export type OwnerLoginFromAppRequestOutcome =
  | { kind: 'service_unavailable' }
  | OwnerLoginResult;

/**
 * First-owner setup from app configuration (database URL check + disposable connection).
 */
export type FirstOwnerSetupFromAppRequestOutcome =
  | { kind: 'service_unavailable' }
  | FirstOwnerSetupResult;

/**
 * Logout from app configuration (database URL check + disposable connection).
 */
export type LogoutFromAppRequestOutcome = { kind: 'service_unavailable' } | LogoutResult;

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
    hashPassword?: (plain: string) => Promise<string>;
  },
) {
  return createAuthUseCases({
    persistence: createDrizzleAuthPersistence(db),
    clock: overrides?.clock ?? (() => new Date()),
    verifyPassword: overrides?.verifyPassword ?? verifyPasswordArgon2id,
    generateSessionToken: overrides?.generateSessionToken ?? generateSessionToken,
    hashPassword: overrides?.hashPassword ?? hashPasswordArgon2id,
  });
}

export async function firstOwnerSetupFromAppRequest(
  app: FastifyInstance,
  rawDisplayName: string,
  rawEmail: string,
  rawPassword: string,
  ctx: { setCookie: boolean; ip: string | null; userAgent: string | null },
): Promise<FirstOwnerSetupFromAppRequestOutcome> {
  const url = getAuthDatabaseUrl(app);
  if (url === undefined) {
    const pre = validateFirstOwnerSetupPayload(rawDisplayName, rawEmail, rawPassword);
    if (pre.kind !== 'ok') {
      return pre;
    }
    return { kind: 'service_unavailable' };
  }

  return withDisposableDatabase(url, async (db) => {
    const useCases = createAuthUseCasesForDatabase(db);
    return useCases.firstOwnerSetup(rawDisplayName, rawEmail, rawPassword, ctx);
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

export async function logoutFromAppRequest(
  app: FastifyInstance,
  rawToken: string | undefined,
): Promise<LogoutFromAppRequestOutcome> {
  const url = getAuthDatabaseUrl(app);
  if (url === undefined) {
    return { kind: 'service_unavailable' };
  }

  return withDisposableDatabase(url, async (db) => {
    const useCases = createAuthUseCasesForDatabase(db);
    return useCases.logout(rawToken);
  });
}
