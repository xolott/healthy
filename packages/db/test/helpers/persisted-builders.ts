/**
 * Focused persisted-row helpers for `@healthy/db` integration tests.
 * Prefer these over repository factories when seeding unrelated rows for FK/state setup.
 */
import type { Database } from '../../src/client.js';
import { auditLogs, sessions, users, type AuditLogRow, type SessionRow, type UserRow } from '../../src/schema/index.js';
import { normalizeEmail } from '../../src/users/normalize-email.js';

export type InsertPersistedUserInput = {
  email: string;
  passwordHash?: string;
  displayName?: string;
  role?: UserRow['role'];
  status?: UserRow['status'];
  deletedAt?: Date | null;
};

export async function insertPersistedUser(db: Database, input: InsertPersistedUserInput): Promise<UserRow> {
  const now = new Date();
  const [row] = await db
    .insert(users)
    .values({
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash ?? 'test$password-hash',
      displayName: input.displayName ?? 'Test User',
      role: input.role ?? 'member',
      status: input.status ?? 'active',
      updatedAt: now,
      deletedAt: input.deletedAt ?? null,
    })
    .returning();
  if (row === undefined) {
    throw new Error('insertPersistedUser: insert did not return a row');
  }
  return row;
}

/** Active owner row (two owners needed → call twice or combine with another helper). */
export async function insertPersistedOwner(db: Database, input: Omit<InsertPersistedUserInput, 'role' | 'status'>): Promise<UserRow> {
  return insertPersistedUser(db, { ...input, role: 'owner', status: 'active' });
}

export type InsertPersistedSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  revokedAt?: Date | null;
};

export async function insertPersistedSession(db: Database, input: InsertPersistedSessionInput): Promise<SessionRow> {
  const [row] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      lastUsedAt: input.lastUsedAt ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      revokedAt: input.revokedAt ?? null,
    })
    .returning();
  if (row === undefined) {
    throw new Error('insertPersistedSession: insert did not return a row');
  }
  return row;
}

export type InsertPersistedAuditLogInput = {
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** Direct insert for scenarios that need audit rows without going through `createAuditLogRepository`. */
export async function insertPersistedAuditLog(db: Database, input: InsertPersistedAuditLogInput): Promise<AuditLogRow> {
  const [row] = await db
    .insert(auditLogs)
    .values({
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning();
  if (row === undefined) {
    throw new Error('insertPersistedAuditLog: insert did not return a row');
  }
  return row;
}
