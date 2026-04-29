import { and, asc, eq } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuditLogRepository } from '../src/audit-logs/repository.js';
import { auditLogs } from '../src/schema/index.js';
import { startPostgresIntegration, type IntegrationHarness } from './helpers/integration-db.js';
import { insertPersistedAuditLog, insertPersistedUser } from './helpers/persisted-builders.js';

describe('audit log repository (integration)', () => {
  let harness: IntegrationHarness;

  beforeAll(async () => {
    harness = await startPostgresIntegration();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it('records a system event without an actor', async () => {
    const repo = createAuditLogRepository(harness.db);
    const before = Date.now();

    const row = await repo.appendAuditLog({
      action: 'system.job.started',
      entityType: null,
      entityId: null,
      summary: 'Nightly job started',
      metadata: { job: 'cleanup' },
      ipAddress: null,
      userAgent: null,
    });

    expect(row.id).toBeDefined();
    expect(row.actorUserId).toBeNull();
    expect(row.action).toBe('system.job.started');
    expect(row.entityType).toBeNull();
    expect(row.entityId).toBeNull();
    expect(row.summary).toBe('Nightly job started');
    expect(row.metadata).toEqual({ job: 'cleanup' });
    expect(row.ipAddress).toBeNull();
    expect(row.userAgent).toBeNull();
    expect(row.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    // append-only schema: no lifecycle columns on this table
    expect('updatedAt' in row).toBe(false);
    expect('deletedAt' in row).toBe(false);
  });

  it('records an actor-attributed event with request context', async () => {
    const auditRepo = createAuditLogRepository(harness.db);

    const user = await insertPersistedUser(harness.db, {
      email: 'actor-audit@example.com',
      displayName: 'Actor',
    });

    const row = await auditRepo.appendAuditLog({
      actorUserId: user.id,
      action: 'user.profile.updated',
      entityType: 'user',
      entityId: user.id,
      summary: 'Display name changed',
      metadata: { field: 'displayName' },
      ipAddress: '203.0.113.10',
      userAgent: 'vitest-integration/1',
    });

    expect(row.actorUserId).toBe(user.id);
    expect(row.action).toBe('user.profile.updated');
    expect(row.entityType).toBe('user');
    expect(row.entityId).toBe(user.id);
    expect(row.ipAddress).toBe('203.0.113.10');
    expect(row.userAgent).toBe('vitest-integration/1');
  });

  it('exposes append-only behavior through the public repository', async () => {
    const repo = createAuditLogRepository(harness.db);
    const keys = Object.keys(repo).sort();
    expect(keys).toEqual(['appendAuditLog']);

    await repo.appendAuditLog({
      action: 'a',
      summary: 'first',
    });
    await repo.appendAuditLog({
      action: 'b',
      summary: 'second',
    });

    const rows = await harness.db.select().from(auditLogs).where(eq(auditLogs.action, 'a'));
    const rowsB = await harness.db.select().from(auditLogs).where(eq(auditLogs.action, 'b'));
    expect(rows).toHaveLength(1);
    expect(rowsB).toHaveLength(1);
    expect(rows[0]!.summary).toBe('first');
    expect(rowsB[0]!.summary).toBe('second');
  });

  it('sets actor_user_id to null when the actor user is hard-deleted', async () => {
    const auditRepo = createAuditLogRepository(harness.db);

    const user = await insertPersistedUser(harness.db, {
      email: 'hard-delete-audit@example.com',
      displayName: 'Gone',
    });

    const log = await auditRepo.appendAuditLog({
      actorUserId: user.id,
      action: 'before.delete',
      summary: 'still linked',
    });
    expect(log.actorUserId).toBe(user.id);

    const client = postgres(harness.connectionUri, { max: 1 });
    try {
      await client`DELETE FROM users WHERE id = ${user.id}`;
    } finally {
      await client.end({ timeout: 5 });
    }

    const [after] = await harness.db.select().from(auditLogs).where(eq(auditLogs.id, log.id)).limit(1);
    expect(after).toBeDefined();
    expect(after!.actorUserId).toBeNull();
    expect(after!.summary).toBe('still linked');
  });

  it('creates indexes for chronology, actor filtering, and entity history', async () => {
    const client = postgres(harness.connectionUri, { max: 1 });
    try {
      const rows = await client<{ indexname: string }[]>`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'audit_logs'
        ORDER BY indexname
      `;
      const names = rows.map((r) => r.indexname);
      expect(names).toEqual(
        expect.arrayContaining([
          'audit_logs_pkey',
          'audit_logs_created_at_idx',
          'audit_logs_actor_user_id_created_at_idx',
          'audit_logs_entity_type_id_created_at_idx',
        ]),
      );

      const cols = await client<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs'
      `;
      const columnNames = cols.map((c) => c.column_name);
      expect(columnNames).not.toContain('updated_at');
      expect(columnNames).not.toContain('deleted_at');
    } finally {
      await client.end({ timeout: 5 });
    }
  });

  it('lists entity-scoped history in created order using the entity index path', async () => {
    await insertPersistedAuditLog(harness.db, {
      action: 'meal.created',
      entityType: 'meal',
      entityId: 'meal-1',
      summary: 'First',
    });
    await new Promise((r) => setTimeout(r, 5));
    await insertPersistedAuditLog(harness.db, {
      action: 'meal.updated',
      entityType: 'meal',
      entityId: 'meal-1',
      summary: 'Second',
    });

    const history = await harness.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, 'meal'), eq(auditLogs.entityId, 'meal-1')))
      .orderBy(asc(auditLogs.createdAt));

    expect(history.map((h) => h.summary)).toEqual(['First', 'Second']);
  });
});
