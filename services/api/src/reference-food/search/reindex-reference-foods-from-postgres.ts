import { referenceFoods, type ReferenceFoodRow } from '@healthy/db/schema';
import type { Database } from '@healthy/db/client';
import { and, asc, eq, gt } from 'drizzle-orm';

import {
  REFERENCE_FOOD_SEARCH_ALIAS_DEFAULT,
  referenceFoodRowToSearchDocument,
  referenceFoodSearchIndexMappingsProperties,
} from './reference-food-search-document.js';
import type {
  ReferenceFoodSearchAliasAction,
  ReferenceFoodSearchIndexerClient,
} from './reference-food-search-indexer-client.js';
import { newVersionedReferenceFoodSearchIndexName } from './versioned-index-name.js';

export class ReferenceFoodSearchReindexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferenceFoodSearchReindexError';
  }
}

export type ReferenceFoodSearchReindexSummary = {
  aliasName: string;
  newIndexName: string;
  indexedDocuments: number;
  previousIndices: string[];
};

export function planReferenceFoodSearchAliasSwap(params: {
  aliasName: string;
  newIndexName: string;
  previousIndices: string[];
}): ReferenceFoodSearchAliasAction[] {
  const actions: ReferenceFoodSearchAliasAction[] = [];
  for (const idx of params.previousIndices) {
    actions.push({ remove: { index: idx, alias: params.aliasName } });
  }
  actions.push({ add: { index: params.newIndexName, alias: params.aliasName } });
  return actions;
}

async function* batchesOfActiveReferenceFoods(
  db: Database,
  batchSize: number,
): AsyncGenerator<ReferenceFoodRow[], void, unknown> {
  let lastId: string | null = null;
  for (;;) {
    const rows: ReferenceFoodRow[] =
      lastId === null
        ? await db
            .select()
            .from(referenceFoods)
            .where(eq(referenceFoods.isActive, true))
            .orderBy(asc(referenceFoods.id))
            .limit(batchSize)
        : await db
            .select()
            .from(referenceFoods)
            .where(and(eq(referenceFoods.isActive, true), gt(referenceFoods.id, lastId)))
            .orderBy(asc(referenceFoods.id))
            .limit(batchSize);
    if (rows.length === 0) {
      return;
    }
    yield rows;
    const tail = rows[rows.length - 1];
    if (tail === undefined) {
      return;
    }
    lastId = tail.id;
  }
}

/**
 * Rebuilds the Reference Food search index from Postgres: creates a new
 * versioned index, bulk-indexes **active** rows only, then atomically moves the
 * stable alias. Inactive foods are omitted from the new index.
 */
export async function reindexReferenceFoodsFromPostgres(options: {
  db: Database;
  client: ReferenceFoodSearchIndexerClient;
  aliasName?: string;
  batchSize?: number;
  /** Fixed name for tests; production should omit to use {@link newVersionedReferenceFoodSearchIndexName}. */
  newIndexName?: string;
}): Promise<ReferenceFoodSearchReindexSummary> {
  const aliasName = options.aliasName ?? REFERENCE_FOOD_SEARCH_ALIAS_DEFAULT;
  const batchSize = options.batchSize ?? 500;
  const newIndexName =
    options.newIndexName ?? newVersionedReferenceFoodSearchIndexName();

  const previousIndices = await options.client.indicesGetAlias({ name: aliasName });

  await options.client.indicesCreate({
    index: newIndexName,
    mappings: { properties: referenceFoodSearchIndexMappingsProperties() },
  });

  let indexedDocuments = 0;
  for await (const batch of batchesOfActiveReferenceFoods(options.db, batchSize)) {
    const operations: unknown[] = [];
    for (const row of batch) {
      operations.push({
        index: { _index: newIndexName, _id: row.id },
      });
      operations.push(referenceFoodRowToSearchDocument(row));
    }
    const bulkRes = await options.client.bulk({ operations, refresh: false });
    if (bulkRes.errors) {
      throw new ReferenceFoodSearchReindexError(
        'Bulk indexing reported errors. Postgres was not modified; fix Elasticsearch and retry.',
      );
    }
    indexedDocuments += batch.length;
  }

  const actions = planReferenceFoodSearchAliasSwap({
    aliasName,
    newIndexName,
    previousIndices,
  });
  await options.client.indicesUpdateAliases({ actions });

  return {
    aliasName,
    newIndexName,
    indexedDocuments,
    previousIndices,
  };
}
