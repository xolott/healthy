/**
 * Shared Drizzle + Postgres.js access; call `createDb` when wiring persistence (e.g. with `DATABASE_URL`).
 */
export { createDb, type Database } from '@healthy/db';
