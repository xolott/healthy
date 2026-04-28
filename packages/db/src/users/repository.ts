import { and, count, eq, isNull } from 'drizzle-orm';

import type { Database } from '../client.js';
import { users, type NewUserRow, type UserRow } from '../schema/index.js';
import { FirstOwnerAlreadyExistsError, LastActiveOwnerInvariantError } from './errors.js';
import { normalizeEmail } from './normalize-email.js';

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  displayName: string;
  role: NonNullable<NewUserRow['role']>;
  status: NonNullable<NewUserRow['status']>;
};

export type CreateFirstOwnerInput = {
  email: string;
  passwordHash: string;
  displayName: string;
};

function isActiveOwner(row: UserRow): boolean {
  return row.role === 'owner' && row.status === 'active' && row.deletedAt === null;
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

  async function assertNotLastActiveOwner(userId: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user === undefined || !isActiveOwner(user)) {
      return;
    }
    const n = await countActiveOwners();
    if (n <= 1) {
      throw new LastActiveOwnerInvariantError();
    }
  }

  async function insertUser(input: CreateUserInput): Promise<UserRow> {
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

  return {
    createUser: insertUser,

    async hasActiveOwner(): Promise<boolean> {
      return (await countActiveOwners()) > 0;
    },

    /** Setup path: create the initial owner when no active owner exists. */
    async createFirstOwner(input: CreateFirstOwnerInput): Promise<UserRow> {
      if ((await countActiveOwners()) > 0) {
        throw new FirstOwnerAlreadyExistsError();
      }
      return insertUser({
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: 'owner',
        status: 'active',
      });
    },

    async findUserById(id: string): Promise<UserRow | undefined> {
      const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return rows[0];
    },

    async findUserByEmail(email: string): Promise<UserRow | undefined> {
      const normalized = normalizeEmail(email);
      const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
      return rows[0];
    },

    async softDeleteUser(id: string): Promise<void> {
      await assertNotLastActiveOwner(id);
      const now = new Date();
      await db.update(users).set({ deletedAt: now, updatedAt: now }).where(eq(users.id, id));
    },

    async updateDisplayName(id: string, displayName: string): Promise<void> {
      const now = new Date();
      await db.update(users).set({ displayName, updatedAt: now }).where(eq(users.id, id));
    },

    async updateUserRole(id: string, role: NonNullable<UserRow['role']>): Promise<void> {
      const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (current === undefined || current.role === role) {
        return;
      }
      if (isActiveOwner(current) && role !== 'owner') {
        await assertNotLastActiveOwner(id);
      }
      const now = new Date();
      await db.update(users).set({ role, updatedAt: now }).where(eq(users.id, id));
    },

    async updateUserStatus(id: string, status: NonNullable<UserRow['status']>): Promise<void> {
      const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (current === undefined || current.status === status) {
        return;
      }
      if (isActiveOwner(current) && status === 'disabled') {
        await assertNotLastActiveOwner(id);
      }
      const now = new Date();
      await db.update(users).set({ status, updatedAt: now }).where(eq(users.id, id));
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
