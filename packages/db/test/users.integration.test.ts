import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import postgres from 'postgres';

import { createUserRepository } from '../src/users/repository.js';
import { startPostgresIntegration, type IntegrationHarness } from './helpers/integration-db.js';

describe('user repository (integration)', () => {
  let harness: IntegrationHarness;

  beforeAll(async () => {
    harness = await startPostgresIntegration();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  it('creates a user with normalized email and timestamps', async () => {
    const repo = createUserRepository(harness.db);
    const before = Date.now();

    const user = await repo.createUser({
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
    const repo = createUserRepository(harness.db);

    await repo.createUser({
      email: 'dup@example.com',
      passwordHash: 'h1',
      displayName: 'First',
      role: 'member',
      status: 'active',
    });

    await expect(
      repo.createUser({
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

  it('soft-deletes and keeps email reserved', async () => {
    const repo = createUserRepository(harness.db);
    const row = await repo.createUser({
      email: 'soft@example.com',
      passwordHash: 'h',
      displayName: 'Soon gone',
      role: 'admin',
      status: 'active',
    });

    await repo.softDeleteUser(row.id);

    const after = await repo.findUserByEmail('soft@example.com');
    expect(after?.deletedAt).not.toBeNull();

    await expect(
      repo.createUser({
        email: 'soft@example.com',
        passwordHash: 'h2',
        displayName: 'Reused',
        role: 'member',
        status: 'active',
      }),
    ).rejects.toThrow();
  });

  it('advances updated_at on display name change and leaves created_at stable', async () => {
    const repo = createUserRepository(harness.db);
    const row = await repo.createUser({
      email: 'time@example.com',
      passwordHash: 'h',
      displayName: 'Original',
      role: 'member',
      status: 'active',
    });

    const createdAt = row.createdAt.getTime();
    const initialUpdated = row.updatedAt.getTime();

    await new Promise((r) => setTimeout(r, 25));

    await repo.updateDisplayName(row.id, 'Renamed');

    const again = await repo.findUserByEmail('time@example.com');
    expect(again).toBeDefined();
    expect(again!.displayName).toBe('Renamed');
    expect(again!.createdAt.getTime()).toBe(createdAt);
    expect(again!.updatedAt.getTime()).toBeGreaterThan(initialUpdated);
  });
});
