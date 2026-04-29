import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { count, eq } from 'drizzle-orm';
import postgres from 'postgres';

import { createSessionRepository } from '../src/sessions/repository.js';
import { sessions, users } from '../src/schema/index.js';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';
import { insertPersistedUser } from './helpers/persisted-builders.js';

describe('session repository (integration)', () => {
  let harness: PostgresTestDatabase;

  beforeAll(async () => {
    harness = await startPostgresTestDatabase();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  beforeEach(async () => {
    await harness.db.delete(users);
  });

  it('creates a session with only a token hash and request context fields', async () => {
    const sessionsRepo = createSessionRepository(harness.db);
    const before = Date.now();

    const user = await insertPersistedUser(harness.db, {
      email: 'u1@example.com',
      passwordHash: 'h',
      displayName: 'U1',
    });

    const expires = new Date(before + 60_000);
    const lastUsed = new Date(before + 1_000);

    const row = await sessionsRepo.createSession({
      userId: user.id,
      tokenHash: 'hash:abc',
      expiresAt: expires,
      lastUsedAt: lastUsed,
      ipAddress: '192.0.2.1',
      userAgent: 'test-agent/1.0',
    });

    expect(row.id).toBeDefined();
    expect(row.userId).toBe(user.id);
    expect(row.tokenHash).toBe('hash:abc');
    expect(row.expiresAt.getTime()).toBe(expires.getTime());
    expect(row.lastUsedAt?.getTime()).toBe(lastUsed.getTime());
    expect(row.ipAddress).toBe('192.0.2.1');
    expect(row.userAgent).toBe('test-agent/1.0');
    expect(row.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(row.revokedAt).toBeNull();
  });

  it('enforces global uniqueness of token hashes', async () => {
    const sessionsRepo = createSessionRepository(harness.db);
    const u1 = await insertPersistedUser(harness.db, {
      email: 'a@example.com',
      displayName: 'A',
    });
    const u2 = await insertPersistedUser(harness.db, {
      email: 'b@example.com',
      displayName: 'B',
    });

    const t = new Date(Date.now() + 60_000);
    await sessionsRepo.createSession({
      userId: u1.id,
      tokenHash: 'shared-hash',
      expiresAt: t,
    });

    await expect(
      sessionsRepo.createSession({
        userId: u2.id,
        tokenHash: 'shared-hash',
        expiresAt: t,
      }),
    ).rejects.toThrow();
  });

  it('revokes a session by token hash', async () => {
    const sessionsRepo = createSessionRepository(harness.db);
    const user = await insertPersistedUser(harness.db, {
      email: 'r@example.com',
      displayName: 'R',
    });
    const t = new Date(Date.now() + 60_000);
    await sessionsRepo.createSession({ userId: user.id, tokenHash: 'to-revoke', expiresAt: t });

    const at = new Date();
    const updated = await sessionsRepo.revokeSessionByTokenHash('to-revoke', at);
    expect(updated).toBeDefined();
    expect(updated!.revokedAt?.getTime()).toBe(at.getTime());

    const found = await sessionsRepo.findSessionByTokenHash('to-revoke');
    expect(found?.revokedAt).not.toBeNull();
  });

  it('exposes migration indexes for expiry lookup and unrevoked cleanup', async () => {
    const client = postgres(harness.connectionUri, { max: 1 });
    try {
      const names = await client`
        select indexname
        from pg_indexes
        where schemaname = 'public' and tablename = 'sessions'
        order by indexname
      `;
      const list = names.map((r) => r.indexname as string);
      expect(list).toContain('sessions_user_id_idx');
      expect(list).toContain('sessions_expires_at_idx');
      expect(list).toContain('sessions_expires_at_unrevoked_idx');
    } finally {
      await client.end({ timeout: 5 });
    }
  });

  it('deletes sessions when a user is hard-deleted (cascade)', async () => {
    const sessionsRepo = createSessionRepository(harness.db);
    const user = await insertPersistedUser(harness.db, {
      email: 'cascade@example.com',
      displayName: 'C',
    });
    const t = new Date(Date.now() + 60_000);
    await sessionsRepo.createSession({ userId: user.id, tokenHash: 'c1', expiresAt: t });

    const [beforeDelete] = await harness.db
      .select({ n: count() })
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    expect(Number(beforeDelete?.n ?? 0)).toBe(1);

    await harness.db.delete(users).where(eq(users.id, user.id));

    const gone = await sessionsRepo.findSessionByTokenHash('c1');
    expect(gone).toBeUndefined();
  });
});
