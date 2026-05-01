import process from 'node:process';

import { createDatabaseAdapter } from '@healthy/db/client';

import { importUsdaJsonReferenceFoods } from '../src/reference-food/import/run-usda-json-reference-food-import.js';

function parseArgs(argv: string[]): { source: string; sourceVersion: string; filePath: string } {
  let source: string | undefined;
  let sourceVersion: string | undefined;
  let filePath: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--source') {
      source = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === '--source-version') {
      sourceVersion = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === '--file') {
      filePath = argv[i + 1];
      i += 1;
      continue;
    }
    throw new Error(`Unexpected argument "${a}".`);
  }

  if (source === undefined || sourceVersion === undefined || filePath === undefined) {
    throw new Error(
      'Usage: tsx scripts/import-usda-reference-food-json.ts --source usda_fdc --source-version VERSION --file PATH.json',
    );
  }

  return { source, sourceVersion, filePath };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required.');
  }

  const { source, sourceVersion, filePath } = parseArgs(process.argv.slice(2));
  const adapter = createDatabaseAdapter(databaseUrl, { max: 1 });
  try {
    const summary = await importUsdaJsonReferenceFoods({
      db: adapter.db,
      source,
      sourceVersion,
      filePath,
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
