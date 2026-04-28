import { eq } from 'drizzle-orm';

import type { Database } from '../client.js';
import { users, type NewUserRow, type UserRow } from '../schema/index.js';
import { normalizeEmail } from './normalize-email.js';

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  displayName: string;
  role: NonNullable<NewUserRow['role']>;
  status: NonNullable<NewUserRow['status']>;
};

export function createUserRepository(db: Database) {
  return {
    async createUser(input: CreateUserInput): Promise<UserRow> {
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
    },

    async findUserByEmail(email: string): Promise<UserRow | undefined> {
      const normalized = normalizeEmail(email);
      const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
      return rows[0];
    },

    async softDeleteUser(id: string): Promise<void> {
      const now = new Date();
      await db.update(users).set({ deletedAt: now, updatedAt: now }).where(eq(users.id, id));
    },

    async updateDisplayName(id: string, displayName: string): Promise<void> {
      const now = new Date();
      await db.update(users).set({ displayName, updatedAt: now }).where(eq(users.id, id));
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
