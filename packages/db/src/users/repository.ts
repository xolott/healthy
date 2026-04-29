import { and, count, eq, isNull } from 'drizzle-orm';

import type { Database } from '../client.js';
import { users, type NewUserRow, type UserRow } from '../schema/index.js';
import { normalizeEmail } from './normalize-email.js';

export type CreateFirstOwnerInput = {
  email: string;
  passwordHash: string;
  displayName: string;
};

/** Unique violation — e.g. concurrent first-owner setups racing on the same email. */
function isPgUniqueViolation(e: unknown): boolean {
  let current: unknown = e;
  for (let depth = 0; depth < 8 && current !== null && current !== undefined; depth += 1) {
    if (typeof current === 'object' && 'code' in current && (current as { code: unknown }).code === '23505') {
      return true;
    }
    if (typeof current === 'object' && current !== null && 'cause' in current) {
      current = (current as { cause: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}

export function createUserRepository(db: Database) {
  async function countActiveOwners(): Promise<number> {
    const [row] = await db
      .select({ n: count() })
      .from(users)
      .where(
        and(eq(users.role, 'owner'), eq(users.status, 'active'), isNull(users.deletedAt)),
      );
    return Number(row?.n ?? 0);
  }

  async function insertUser(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    role: NonNullable<NewUserRow['role']>;
    status: NonNullable<NewUserRow['status']>;
  }): Promise<UserRow> {
    const normalized = normalizeEmail(input.email);
    const now = new Date();
    const [row] = await db
      .insert(users)
      .values({
        email: normalized,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: input.role,
        status: input.status,
        updatedAt: now,
      })
      .returning();
    if (row === undefined) {
      throw new Error('insert did not return a row');
    }
    return row;
  }

  /**
   * Setup path: create the initial owner when no active owner exists.
   * Returns a closed outcome (no thrown errors for duplicate / owner-already-present cases).
   */
  async function createFirstOwnerIfNoneExistsImpl(
    input: CreateFirstOwnerInput,
  ): Promise<{ kind: 'created'; row: UserRow } | { kind: 'already_exists' }> {
    if ((await countActiveOwners()) > 0) {
      return { kind: 'already_exists' };
    }
    try {
      const row = await insertUser({
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: 'owner',
        status: 'active',
      });
      return { kind: 'created', row };
    } catch (e) {
      if (isPgUniqueViolation(e)) {
        return { kind: 'already_exists' };
      }
      throw e;
    }
  }

  return {
    async hasActiveOwner(): Promise<boolean> {
      return (await countActiveOwners()) > 0;
    },

    createFirstOwnerIfNoneExists: createFirstOwnerIfNoneExistsImpl,
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
