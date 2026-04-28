/**
 * Drizzle schema entrypoint (see `drizzle.config.ts` for Kit).
 * Kept in one module so Drizzle Kit can load it without pre-built `.js` peers.
 */
import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Instance role; see PRD Implementation Decisions. */
export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'member']);

/** Account lifecycle status. */
export const userStatusEnum = pgEnum('user_status', ['active', 'disabled']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Lowercased, trimmed; unique including soft-deleted rows so emails stay reserved. */
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

/** Relational schema map passed to `drizzle({ schema })`. */
export const schema = { users };
