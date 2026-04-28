import type { Database } from '../client.js';
import { auditLogs, type AuditLogRow, type NewAuditLogRow } from '../schema/index.js';

export type AppendAuditLogInput = {
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Append-only audit persistence: callers may insert events only.
 * There is no update or delete surface on this repository.
 */
export function createAuditLogRepository(db: Database) {
  return {
    async appendAuditLog(input: AppendAuditLogInput): Promise<AuditLogRow> {
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
        } satisfies Pick<
          NewAuditLogRow,
          | 'actorUserId'
          | 'action'
          | 'entityType'
          | 'entityId'
          | 'summary'
          | 'metadata'
          | 'ipAddress'
          | 'userAgent'
        >)
        .returning();
      if (row === undefined) {
        throw new Error('insert did not return a row');
      }
      return row;
    },
  };
}

export type AuditLogRepository = ReturnType<typeof createAuditLogRepository>;
