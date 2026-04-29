/**
 * Constructs Auth Use Cases backed by Drizzle persistence on an existing database handle.
 * `createRequestScopeForApp` uses this inside disposable-database scopes; Drizzle-backed
 * integration tests call it with an open harness handle. Routes depend on Request Scope only.
 */

import type { Database } from '@healthy/db';

import { createDrizzleAuthPersistence } from './auth-persistence.js';
import { createAuthUseCases } from './auth-use-cases.js';
import { hashPasswordArgon2id, verifyPasswordArgon2id } from './hash-password.js';
import { generateSessionToken } from './session-token.js';

export type { AuthMeUser } from './auth-use-cases.js';

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
