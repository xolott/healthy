import { defineConfig } from 'drizzle-kit';

/** Drizzle Kit reads `DATABASE_URL` for migrate/studio/push; a placeholder is only for local tooling without env. */
const databaseUrl =
  process.env['DATABASE_URL'] ?? 'postgresql://127.0.0.1:5432/healthy_placeholder';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
});
