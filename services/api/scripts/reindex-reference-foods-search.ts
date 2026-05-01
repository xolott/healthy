import process from 'node:process';

import { createDatabaseAdapter } from '@healthy/db/client';

import { adaptElasticsearchClient } from '../src/reference-food/search/reference-food-search-indexer-client.js';
import { createElasticsearchClientFromEnv } from '../src/reference-food/search/create-elasticsearch-client.js';
import { reindexReferenceFoodsFromPostgres } from '../src/reference-food/search/reindex-reference-foods-from-postgres.js';

function parseArgs(argv: string[]): { alias?: string } {
  let alias: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--alias') {
      alias = argv[i + 1];
      i += 1;
      continue;
    }
    throw new Error(`Unexpected argument "${a}".`);
  }
  return { alias };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required.');
  }

  const { alias: aliasFromCli } = parseArgs(process.argv.slice(2));
  const es = createElasticsearchClientFromEnv();
  const port = adaptElasticsearchClient(es);

  const adapter = createDatabaseAdapter(databaseUrl, { max: 1 });
  try {
    const summary = await reindexReferenceFoodsFromPostgres({
      db: adapter.db,
      client: port,
      ...(aliasFromCli !== undefined ? { aliasName: aliasFromCli } : {}),
    });
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } finally {
    await adapter.close();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
