import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

import type { Database } from '../../src/client.js';
import { schema } from '../../src/schema/index.js';

const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export type IntegrationHarness = {
  db: Database;
  client: ReturnType<typeof postgres>;
  connectionUri: string;
  dispose: () => Promise<void>;
};

export async function startPostgresIntegration(): Promise<IntegrationHarness> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const connectionUri = container.getConnectionUri();
  const client = postgres(connectionUri, { max: 10 });
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(packageRoot, 'drizzle') });

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
