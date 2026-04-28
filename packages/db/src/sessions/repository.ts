import { and, count, eq, isNull, lt } from 'drizzle-orm';

import type { Database } from '../client.js';
import { sessions, type NewSessionRow, type SessionRow } from '../schema/index.js';

/**
 * New sessions are created only with a pre-computed `tokenHash`.
 * A raw session token is never part of the data-access contract.
 */
export type CreateSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function createSessionRepository(db: Database) {
  return {
    async createSession(input: CreateSessionInput): Promise<SessionRow> {
      const [row] = await db
        .insert(sessions)
        .values({
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          lastUsedAt: input.lastUsedAt ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        } satisfies Pick<
          NewSessionRow,
          'userId' | 'tokenHash' | 'expiresAt' | 'lastUsedAt' | 'ipAddress' | 'userAgent'
        >)
        .returning();
      if (row === undefined) {
        throw new Error('insert did not return a row');
      }
      return row;
    },

    async findSessionByTokenHash(tokenHash: string): Promise<SessionRow | undefined> {
      const [row] = await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);
      return row;
    },

    /**
     * Marks a session as revoked. Idempotent: already-revoked rows are left unchanged
     * and the latest row (unchanged) is not returned; caller should use find if needed.
     */
    async revokeSessionByTokenHash(tokenHash: string, at: Date = new Date()): Promise<SessionRow | undefined> {
      const [row] = await db
        .update(sessions)
        .set({ revokedAt: at })
        .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
        .returning();
      return row;
    },

    /**
     * Rows eligible for cleanup: past expiry, not yet revoked. Uses `expires_at` indexes.
     */
    async listExpiredUnrevokedSessions(asOf: Date = new Date()): Promise<SessionRow[]> {
      return db
        .select()
        .from(sessions)
        .where(and(lt(sessions.expiresAt, asOf), isNull(sessions.revokedAt)));
    },

    async countByUserId(userId: string): Promise<number> {
      const [r] = await db
        .select({ n: count() })
        .from(sessions)
        .where(eq(sessions.userId, userId));
      return Number(r?.n ?? 0);
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
