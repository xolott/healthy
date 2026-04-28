import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

import type { Database } from '@healthy/db';
import { schema } from '@healthy/db/schema';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

export type ApiIntegrationHarness = {
  db: Database;
  client: ReturnType<typeof postgres>;
  connectionUri: string;
  dispose: () => Promise<void>;
};

export async function startApiPostgresIntegration(): Promise<ApiIntegrationHarness> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const connectionUri = container.getConnectionUri();
  const client = postgres(connectionUri, { max: 10 });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(repoRoot, 'packages', 'db', 'drizzle') });

  return {
    db,
    client,
    connectionUri,
    async dispose() {
      await client.end({ timeout: 5 });
      await container.stop();
    },
  };
}
