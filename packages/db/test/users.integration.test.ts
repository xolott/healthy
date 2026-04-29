import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import postgres from 'postgres';

import { createSetupStatusPersistence } from '../src/setup-status/index.js';
import { createUserRepository } from '../src/users/repository.js';
import { users } from '../src/schema/index.js';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';
import { insertPersistedUser } from './helpers/persisted-builders.js';

describe('user repository (integration)', () => {
  let harness: PostgresTestDatabase;

  beforeAll(async () => {
    harness = await startPostgresTestDatabase();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it('persists normalized email when inserting via shared normalization rules', async () => {
    const before = Date.now();

    const user = await insertPersistedUser(harness.db, {
      email: '  Owner@Example.com ',
      passwordHash: 'argon2id$fake',
      displayName: 'Owner',
      role: 'owner',
      status: 'active',
    });

    expect(user.email).toBe('owner@example.com');
    expect(user.displayName).toBe('Owner');
    expect(user.role).toBe('owner');
    expect(user.status).toBe('active');
    expect(user.deletedAt).toBeNull();
    expect(user.lastLoginAt).toBeNull();
    expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('rejects duplicate normalized emails', async () => {
    await insertPersistedUser(harness.db, {
      email: 'dup@example.com',
      passwordHash: 'h1',
      displayName: 'First',
      role: 'member',
      status: 'active',
    });

    await expect(
      insertPersistedUser(harness.db, {
        email: 'DUP@EXAMPLE.COM',
        passwordHash: 'h2',
        displayName: 'Second',
        role: 'member',
        status: 'active',
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid user_role values at the database', async () => {
    const client = postgres(harness.connectionUri, { max: 1 });
    try {
      await expect(
        client.unsafe(`
          INSERT INTO users (email, password_hash, display_name, role, status, updated_at)
          VALUES ('role-bogus@example.com', 'h', 'x', 'superuser'::user_role, 'active'::user_status, now())
        `),
      ).rejects.toThrow();
    } finally {
      await client.end({ timeout: 5 });
    }
  });

  it('rejects invalid user_status values at the database', async () => {
    const client = postgres(harness.connectionUri, { max: 1 });
    try {
      await expect(
        client.unsafe(`
          INSERT INTO users (email, password_hash, display_name, role, status, updated_at)
          VALUES ('status-bogus@example.com', 'h', 'x', 'member'::user_role, 'pending'::user_status, now())
        `),
      ).rejects.toThrow();
    } finally {
      await client.end({ timeout: 5 });
    }
  });

  describe('owner setup', () => {
    let ownerHarness: PostgresTestDatabase;

    beforeAll(async () => {
      ownerHarness = await startPostgresTestDatabase();
    });

    beforeEach(async () => {
      await ownerHarness.db.delete(users);
    });

    afterAll(async () => {
      await ownerHarness.dispose();
    });

    it('reports hasActiveOwner only after an active owner exists', async () => {
      const repo = createUserRepository(ownerHarness.db);
      expect(await repo.hasActiveOwner()).toBe(false);
      const outcome = await repo.createFirstOwnerIfNoneExists({
        email: 'owner-present@example.com',
        passwordHash: 'h',
        displayName: 'Founder',
      });
      expect(outcome.kind).toBe('created');
      expect(await repo.hasActiveOwner()).toBe(true);
    });

    it('setup status persistence reports first-owner setup required until an active owner exists', async () => {
      const setupStatus = createSetupStatusPersistence(ownerHarness.db);
      expect(await setupStatus.isFirstOwnerSetupRequired()).toBe(true);
      const repo = createUserRepository(ownerHarness.db);
      await repo.createFirstOwnerIfNoneExists({
        email: 'setup-status@example.com',
        passwordHash: 'h',
        displayName: 'Founder',
      });
      expect(await setupStatus.isFirstOwnerSetupRequired()).toBe(false);
    });

    it('creates the first owner via setup with role owner and active status', async () => {
      const repo = createUserRepository(ownerHarness.db);

      const outcome = await repo.createFirstOwnerIfNoneExists({
        email: 'setup@example.com',
        passwordHash: 'argon2id$fake',
        displayName: 'Founder',
      });

      expect(outcome.kind).toBe('created');
      if (outcome.kind !== 'created') {
        throw new Error('expected created');
      }
      expect(outcome.row.role).toBe('owner');
      expect(outcome.row.status).toBe('active');
      expect(outcome.row.email).toBe('setup@example.com');
    });

    it('returns already_exists from createFirstOwnerIfNoneExists when an active owner already exists', async () => {
      const repo = createUserRepository(ownerHarness.db);

      const first = await repo.createFirstOwnerIfNoneExists({
        email: 'first@example.com',
        passwordHash: 'h',
        displayName: 'First',
      });
      expect(first.kind).toBe('created');

      const second = await repo.createFirstOwnerIfNoneExists({
        email: 'second@example.com',
        passwordHash: 'h',
        displayName: 'Second',
      });
      expect(second.kind).toBe('already_exists');
    });
  });
});
