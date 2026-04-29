import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import type { Database } from '../client.js';
import { schema } from '../schema/index.js';

/** Typed integration harness: Drizzle handle, URL for app wiring, disposal (no raw postgres client). */
export type PostgresTestDatabase = {
  db: Database;
  connectionUri: string;
  dispose: () => Promise<void>;
};

function moduleDirname(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

/** Drizzle migrations folder for both `src/testing/` and `dist/testing/` layouts (`../../drizzle` from this file). */
function resolveMigrationsFolder(): string {
  const folder = path.join(moduleDirname(), '..', '..', 'drizzle');
  if (!existsSync(folder)) {
    throw new Error(
      `Could not find migrations folder at ${folder} (expected next to @healthy/db package root from test support module)`,
    );
  }
  return folder;
}

async function safeDispose(
  client: ReturnType<typeof postgres>,
  container: { stop(): Promise<unknown> },
): Promise<void> {
  const errors: unknown[] = [];
  try {
    await client.end({ timeout: 5 });
  } catch (e) {
    errors.push(e);
  }
  try {
    await container.stop();
  } catch (e) {
    errors.push(e);
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'PostgresTestDatabase cleanup failed');
  }
}

async function cleanupAfterStartupFailure(
  client: ReturnType<typeof postgres> | undefined,
  container: { stop(): Promise<unknown> } | undefined,
): Promise<void> {
  if (client) {
    try {
      await client.end({ timeout: 5 });
    } catch {
      /* best effort */
    }
  }
  if (container) {
    try {
      await container.stop();
    } catch {
      /* best effort */
    }
  }
}

export async function startPostgresTestDatabase(): Promise<PostgresTestDatabase> {
  let container: Awaited<ReturnType<InstanceType<typeof PostgreSqlContainer>['start']>> | undefined;
  let client: ReturnType<typeof postgres> | undefined;

  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const connectionUri = container.getConnectionUri();
    client = postgres(connectionUri, { max: 10 });
    const db = drizzle({ client, schema });
    const migrationsFolder = resolveMigrationsFolder();
    await migrate(db, { migrationsFolder });

    const clientRef = client;
    const containerRef = container;

    return {
      db,
      connectionUri,
      dispose: () => safeDispose(clientRef, containerRef),
    };
  } catch (err) {
    await cleanupAfterStartupFailure(client, container);
    throw err;
  }
}
