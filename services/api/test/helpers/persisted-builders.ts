/**
 * API integration test helpers for persisted rows. Uses Drizzle directly against the harness
 * database so tests do not depend on {@link createUserRepository} / {@link createSessionRepository}.
 * Email canonicalization matches {@link canonicalizeAuthEmailForPersistence}.
 */

import { and, count, eq, isNull } from 'drizzle-orm';

import type { Database } from '@healthy/db';
import { canonicalizeAuthEmailForPersistence } from '../../src/auth/auth-persistence.js';
import { pantryItems, sessions, users, type PantryItemRow, type SessionRow, type UserRow } from '@healthy/db/schema';

export type PersistedUserInsertInput = {
  email: string;
  passwordHash: string;
  displayName: string;
  role: NonNullable<UserRow['role']>;
  status: NonNullable<UserRow['status']>;
};

export type PersistedSessionInsertInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function insertPersistedUser(db: Database, input: PersistedUserInsertInput): Promise<UserRow> {
  const email = canonicalizeAuthEmailForPersistence(input.email);
  const now = new Date();
  const [row] = await db
    .insert(users)
    .values({
      email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: input.role,
      status: input.status,
      updatedAt: now,
    })
    .returning();
  if (row === undefined) {
    throw new Error('insertPersistedUser did not return a row');
  }
  return row;
}

export async function insertPersistedSession(
  db: Database,
  input: PersistedSessionInsertInput,
): Promise<SessionRow> {
  const [row] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      lastUsedAt: input.lastUsedAt ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning();
  if (row === undefined) {
    throw new Error('insertPersistedSession did not return a row');
  }
  return row;
}

export async function persistedFindUserByEmail(db: Database, email: string): Promise<UserRow | undefined> {
  const normalized = canonicalizeAuthEmailForPersistence(email);
  const [row] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return row;
}

export async function persistedFindUserById(db: Database, id: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function persistedFindSessionByTokenHash(
  db: Database,
  tokenHash: string,
): Promise<SessionRow | undefined> {
  const [row] = await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);
  return row;
}

export async function persistedHasActiveOwner(db: Database): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, 'owner'), eq(users.status, 'active'), isNull(users.deletedAt)));
  return Number(row?.n ?? 0) > 0;
}

export type PersistedPantryItemInsertInput = {
  ownerUserId: string;
  itemType: 'food' | 'recipe';
  name: string;
  iconKey: string;
};

export async function insertPersistedPantryItem(db: Database, input: PersistedPantryItemInsertInput): Promise<PantryItemRow> {
  const now = new Date();
  const [row] = await db
    .insert(pantryItems)
    .values({
      ownerUserId: input.ownerUserId,
      itemType: input.itemType,
      name: input.name,
      iconKey: input.iconKey,
      metadata: {},
      updatedAt: now,
    })
    .returning();
  if (row === undefined) {
    throw new Error('insertPersistedPantryItem did not return a row');
  }
  return row;
}

export async function persistedFindPantryItemById(db: Database, id: string): Promise<PantryItemRow | undefined> {
  const [row] = await db.select().from(pantryItems).where(eq(pantryItems.id, id)).limit(1);
  return row;
}
