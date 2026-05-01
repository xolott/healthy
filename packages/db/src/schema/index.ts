/**
 * Drizzle schema entrypoint (see `drizzle.config.ts` for Kit).
 * Kept in one module so Drizzle Kit can load it without pre-built `.js` peers.
 */
import { isNull, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

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

/** Revocable user sessions: only `token_hash` is stored, never a raw session token. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('sessions_user_id_idx').on(t.userId),
    index('sessions_expires_at_idx').on(t.expiresAt),
    index('sessions_expires_at_unrevoked_idx')
      .on(t.expiresAt)
      .where(isNull(t.revokedAt)),
  ],
);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;

/**
 * Append-only audit trail: inserts only; no `updated_at` / `deleted_at`.
 * `actor_user_id` is cleared (SET NULL) if the referenced user row is hard-deleted.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_created_at_idx').on(t.createdAt),
    index('audit_logs_actor_user_id_created_at_idx').on(t.actorUserId, t.createdAt),
    index('audit_logs_entity_type_id_created_at_idx').on(t.entityType, t.entityId, t.createdAt),
  ],
);

export type AuditLogRow = typeof auditLogs.$inferSelect;
export type NewAuditLogRow = typeof auditLogs.$inferInsert;

export const pantryItemTypeEnum = pgEnum('pantry_item_type', ['food', 'recipe']);

/** Whether a Food Log Entry links to a Pantry Item or a catalog Reference Food. */
export const foodLogEntryItemSourceEnum = pgEnum('food_log_entry_item_source', [
  'pantry',
  'reference_food',
]);

/**
 * App-wide nutrient catalog (seeded in migrations). Amounts recorded per Food use these keys and units.
 * Primary key `key` is the stable lowercase wire identifier.
 */
export const nutrients = pgTable(
  'nutrients',
  {
    key: text('key').primaryKey(),
    displayName: text('display_name').notNull(),
    canonicalUnit: text('canonical_unit').notNull(),
  },
  (t) => [index('nutrients_canonical_unit_idx').on(t.canonicalUnit)],
);

export type NutrientRow = typeof nutrients.$inferSelect;

/**
 * Shared root for Foods and Recipes: ownership, polymorphic identity, naming, icons, flexible metadata.
 */
export const pantryItems = pgTable(
  'pantry_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemType: pantryItemTypeEnum('item_type').notNull(),
    name: text('name').notNull(),
    iconKey: text('icon_key').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('pantry_items_owner_item_type_created_at_idx').on(t.ownerUserId, t.itemType, t.createdAt),
    index('pantry_items_owner_name_idx').on(t.ownerUserId, t.name),
  ],
);

export type PantryItemRow = typeof pantryItems.$inferSelect;
export type NewPantryItemRow = typeof pantryItems.$inferInsert;

/** One persisted row of a Food ingredient inside a Recipe (serving + quantity). */
export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipePantryItemId: uuid('recipe_pantry_item_id')
      .notNull()
      .references(() => pantryItems.id, { onDelete: 'cascade' }),
    ingredientFoodPantryItemId: uuid('ingredient_food_pantry_item_id')
      .notNull()
      .references(() => pantryItems.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull().default(0),
    servingKind: text('serving_kind').notNull(),
    servingUnitKey: text('serving_unit_key'),
    servingCustomLabel: text('serving_custom_label'),
    quantity: doublePrecision('quantity').notNull(),
  },
  (t) => [index('recipe_ingredients_recipe_sort_idx').on(t.recipePantryItemId, t.sortOrder)],
);

export type RecipeIngredientRow = typeof recipeIngredients.$inferSelect;
export type NewRecipeIngredientRow = typeof recipeIngredients.$inferInsert;

/**
 * Source-owned catalog row (e.g. USDA), not a user Pantry Item.
 * Uniqueness is `(source, sourceFoodId)` per external stable identifiers.
 */
export const referenceFoods = pgTable(
  'reference_foods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(),
    sourceFoodId: text('source_food_id').notNull(),
    displayName: text('display_name').notNull(),
    brand: text('brand'),
    baseAmountGrams: doublePrecision('base_amount_grams').notNull(),
    calories: doublePrecision('calories').notNull(),
    proteinGrams: doublePrecision('protein_grams').notNull(),
    fatGrams: doublePrecision('fat_grams').notNull(),
    carbohydratesGrams: doublePrecision('carbohydrates_grams').notNull(),
    iconKey: text('icon_key').notNull().default('food_bowl'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex('reference_foods_source_source_food_id_uidx').on(t.source, t.sourceFoodId)],
);

export type ReferenceFoodRow = typeof referenceFoods.$inferSelect;
export type NewReferenceFoodRow = typeof referenceFoods.$inferInsert;

/**
 * One logged consumption of a Pantry Item, snapshotting display and nutrition facts.
 *
 * **Future-ready fields (edit/delete/move without migrating shape):**
 * - `consumed_at` — per-entry instant; reschedule flows may update this alongside
 *   `consumed_date` without creating a new snapshot row.
 * - `quantity`, `serving_*` — servings and nutrient snapshot columns persist edits
 *   when PATCH-style flows arrive.
 * - `deleted_at` — soft-delete; day reads must filter `deleted_at IS NULL` (API:
 *   `listFoodLogEntriesForOwnerDate`).
 *
 * Individual edit/move/delete UX and operator admin parity are out of scope for
 * the mobile-first slice; parity is documented in CONTEXT and ADR 0002.
 */
export const foodLogEntries = pgTable(
  'food_log_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemSource: foodLogEntryItemSourceEnum('item_source').notNull().default('pantry'),
    pantryItemId: uuid('pantry_item_id').references(() => pantryItems.id, { onDelete: 'set null' }),
    pantryItemType: pantryItemTypeEnum('pantry_item_type'),
    referenceFoodId: uuid('reference_food_id').references(() => referenceFoods.id, {
      onDelete: 'restrict',
    }),
    /** Snapshot of catalog source key at log time (immutable). */
    referenceFoodSource: text('reference_food_source'),
    /** Snapshot of provider stable food id at log time (immutable). */
    referenceSourceFoodId: text('reference_source_food_id'),
    displayName: text('display_name').notNull(),
    iconKey: text('icon_key').notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }).notNull(),
    consumedDate: date('consumed_date', { mode: 'string' }).notNull(),
    servingKind: text('serving_kind').notNull(),
    servingUnitKey: text('serving_unit_key'),
    servingCustomLabel: text('serving_custom_label'),
    quantity: doublePrecision('quantity').notNull(),
    calories: doublePrecision('calories').notNull(),
    proteinGrams: doublePrecision('protein_grams').notNull(),
    fatGrams: doublePrecision('fat_grams').notNull(),
    carbohydratesGrams: doublePrecision('carbohydrates_grams').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('food_log_entries_owner_date_time_idx')
      .on(t.ownerUserId, t.consumedDate, t.consumedAt, t.id)
      .where(isNull(t.deletedAt)),
    index('food_log_entries_owner_pantry_item_idx').on(t.ownerUserId, t.pantryItemId),
  ],
);

export type FoodLogEntryRow = typeof foodLogEntries.$inferSelect;
export type NewFoodLogEntryRow = typeof foodLogEntries.$inferInsert;

/** Relational schema map passed to `drizzle({ schema })`. */
export const schema = {
  users,
  sessions,
  auditLogs,
  nutrients,
  pantryItems,
  recipeIngredients,
  referenceFoods,
  foodLogEntries,
};
