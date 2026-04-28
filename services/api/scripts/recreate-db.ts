import { spawn } from 'node:child_process';

import postgres from 'postgres';

const databaseUrl = process.env['DATABASE_URL'];

if (databaseUrl === undefined || databaseUrl.trim() === '') {
  throw new Error('DATABASE_URL is required to recreate the local database tables.');
}

const parsedDatabaseUrl = new URL(databaseUrl);
const localHosts = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);
const allowNonLocal = process.env['ALLOW_NON_LOCAL_DB_RECREATE'] === '1';

if (process.env['NODE_ENV'] === 'production') {
  throw new Error('Refusing to recreate database tables while NODE_ENV=production.');
}

if (!localHosts.has(parsedDatabaseUrl.hostname) && !allowNonLocal) {
  throw new Error(
    `Refusing to recreate database tables for non-local host ${JSON.stringify(
      parsedDatabaseUrl.hostname,
    )}. Set ALLOW_NON_LOCAL_DB_RECREATE=1 to override.`,
  );
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
  await sql`DROP SCHEMA IF EXISTS public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql`GRANT ALL ON SCHEMA public TO public`;
} finally {
  await sql.end();
}

await new Promise<void>((resolve, reject) => {
  const child = spawn('pnpm', ['--filter', 'api', 'db:migrate'], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', reject);
  child.on('exit', (code, signal) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(`Migration command failed with ${signal ?? `exit code ${code}`}.`));
  });
});
