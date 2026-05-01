import { referenceFoods } from '@healthy/db/schema';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { ReferenceFoodSearchIndexerClient } from '../src/reference-food/search/reference-food-search-indexer-client.js';
import { readElasticsearchAuthFromEnv } from '../src/reference-food/search/create-elasticsearch-client.js';
import {
  planReferenceFoodSearchAliasSwap,
  ReferenceFoodSearchReindexError,
  reindexReferenceFoodsFromPostgres,
} from '../src/reference-food/search/reindex-reference-foods-from-postgres.js';
import { newVersionedReferenceFoodSearchIndexName } from '../src/reference-food/search/versioned-index-name.js';
import { insertPersistedReferenceFood } from './helpers/persisted-builders.js';

type RecordingIndexer = ReferenceFoodSearchIndexerClient & {
  records: {
    created: Array<{ index: string }>;
    aliasesRequested: string[];
    bulkCalls: number;
    indexedIds: string[];
    aliasActions: Array<{ add?: unknown; remove?: unknown }>;
  };
};

function createRecordingIndexerClient(options: {
  bulkErrors?: boolean;
  previousIndices?: string[];
}): RecordingIndexer {
  const records = {
    created: [] as Array<{ index: string }>,
    aliasesRequested: [] as string[],
    bulkCalls: 0,
    indexedIds: [] as string[],
    aliasActions: [] as Array<{ add?: unknown; remove?: unknown }>,
  };

  const previousIndices = options.previousIndices ?? [];

  const client: RecordingIndexer = {
    records,
    async indicesCreate({ index }) {
      records.created.push({ index });
    },
    async indicesGetAlias({ name }) {
      records.aliasesRequested.push(name);
      return previousIndices;
    },
    async bulk({ operations }) {
      records.bulkCalls += 1;
      for (let i = 0; i < operations.length; i += 2) {
        const action = operations[i] as { index?: { _id?: string } };
        const id = action.index?._id;
        if (typeof id === 'string') {
          records.indexedIds.push(id);
        }
      }
      return { errors: options.bulkErrors ?? false };
    },
    async indicesUpdateAliases({ actions }) {
      records.aliasActions.push(...actions);
    },
  };

  return client;
}

describe('planReferenceFoodSearchAliasSwap', () => {
  it('removes prior concrete indices then adds the new index for the alias', () => {
    const actions = planReferenceFoodSearchAliasSwap({
      aliasName: 'reference_foods_search',
      newIndexName: 'reference_foods_search_v_new',
      previousIndices: ['reference_foods_search_v_old_a', 'reference_foods_search_v_old_b'],
    });
    expect(actions).toEqual([
      { remove: { index: 'reference_foods_search_v_old_a', alias: 'reference_foods_search' } },
      { remove: { index: 'reference_foods_search_v_old_b', alias: 'reference_foods_search' } },
      { add: { index: 'reference_foods_search_v_new', alias: 'reference_foods_search' } },
    ]);
  });

  it('only adds when there is no previous index', () => {
    const actions = planReferenceFoodSearchAliasSwap({
      aliasName: 'reference_foods_search',
      newIndexName: 'reference_foods_search_v_first',
      previousIndices: [],
    });
    expect(actions).toEqual([
      { add: { index: 'reference_foods_search_v_first', alias: 'reference_foods_search' } },
    ]);
  });
});

describe('newVersionedReferenceFoodSearchIndexName', () => {
  it('is lowercase and valid for Elasticsearch index naming', () => {
    const name = newVersionedReferenceFoodSearchIndexName(new Date('2026-04-30T15:04:05.000Z'));
    expect(name).toBe('reference_foods_search_v_20260430t150405z');
    expect(name).toMatch(/^[a-z0-9_]+$/);
  });
});

describe('reindexReferenceFoodsFromPostgres', () => {
  let harness: PostgresTestDatabase;

  beforeAll(async () => {
    harness = await startPostgresTestDatabase();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  beforeEach(async () => {
    await harness.db.delete(referenceFoods);
  });

  it('bulk-indexes only active Reference Foods', async () => {
    const activeA = await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'a',
      displayName: 'Active A',
      baseAmountGrams: 100,
      calories: 1,
      proteinGrams: 1,
      fatGrams: 1,
      carbohydratesGrams: 1,
      isActive: true,
    });
    await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'b',
      displayName: 'Inactive',
      baseAmountGrams: 100,
      calories: 1,
      proteinGrams: 1,
      fatGrams: 1,
      carbohydratesGrams: 1,
      isActive: false,
    });
    const activeC = await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'c',
      displayName: 'Active C',
      baseAmountGrams: 100,
      calories: 1,
      proteinGrams: 1,
      fatGrams: 1,
      carbohydratesGrams: 1,
      isActive: true,
    });

    const client = createRecordingIndexerClient({});
    const summary = await reindexReferenceFoodsFromPostgres({
      db: harness.db,
      client,
      aliasName: 'reference_foods_search',
      batchSize: 10,
      newIndexName: 'reference_foods_search_v_test',
    });

    expect(summary.indexedDocuments).toBe(2);
    expect(client.records.indexedIds.sort()).toEqual([activeA.id, activeC.id].sort());
    expect(client.records.bulkCalls).toBe(1);
  });

  it('plans alias removal from previously aliased indices', async () => {
    await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'a',
      displayName: 'Active A',
      baseAmountGrams: 100,
      calories: 1,
      proteinGrams: 1,
      fatGrams: 1,
      carbohydratesGrams: 1,
      isActive: true,
    });

    const client = createRecordingIndexerClient({
      previousIndices: ['reference_foods_search_v_prev'],
    });
    await reindexReferenceFoodsFromPostgres({
      db: harness.db,
      client,
      aliasName: 'reference_foods_search',
      batchSize: 10,
      newIndexName: 'reference_foods_search_v_next',
    });

    expect(client.records.aliasActions).toEqual([
      { remove: { index: 'reference_foods_search_v_prev', alias: 'reference_foods_search' } },
      { add: { index: 'reference_foods_search_v_next', alias: 'reference_foods_search' } },
    ]);
  });

  it('throws ReferenceFoodSearchReindexError when bulk reports errors', async () => {
    await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'a',
      displayName: 'Active A',
      baseAmountGrams: 100,
      calories: 1,
      proteinGrams: 1,
      fatGrams: 1,
      carbohydratesGrams: 1,
      isActive: true,
    });

    const client = createRecordingIndexerClient({ bulkErrors: true });
    await expect(
      reindexReferenceFoodsFromPostgres({
        db: harness.db,
        client,
        newIndexName: 'reference_foods_search_v_err',
        batchSize: 10,
      }),
    ).rejects.toThrow(ReferenceFoodSearchReindexError);

    expect(client.records.aliasActions.length).toBe(0);
  });
});

describe('readElasticsearchAuthFromEnv', () => {
  const keys = [
    'ELASTICSEARCH_API_KEY',
    'ELASTICSEARCH_USERNAME',
    'ELASTICSEARCH_PASSWORD',
  ] as const;

  function stashEnv(): Record<(typeof keys)[number], string | undefined> {
    const out = {} as Record<(typeof keys)[number], string | undefined>;
    for (const k of keys) {
      out[k] = process.env[k];
    }
    return out;
  }

  function restoreEnv(stashed: Record<(typeof keys)[number], string | undefined>) {
    for (const k of keys) {
      const v = stashed[k];
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }

  it('prefers API key when set', () => {
    const stashed = stashEnv();
    try {
      process.env.ELASTICSEARCH_API_KEY = 'k';
      process.env.ELASTICSEARCH_USERNAME = 'u';
      process.env.ELASTICSEARCH_PASSWORD = 'p';
      expect(readElasticsearchAuthFromEnv()).toEqual({ apiKey: 'k' });
    } finally {
      restoreEnv(stashed);
    }
  });

  it('uses username/password when API key is absent', () => {
    const stashed = stashEnv();
    try {
      delete process.env.ELASTICSEARCH_API_KEY;
      process.env.ELASTICSEARCH_USERNAME = 'u';
      process.env.ELASTICSEARCH_PASSWORD = 'p';
      expect(readElasticsearchAuthFromEnv()).toEqual({
        username: 'u',
        password: 'p',
      });
    } finally {
      restoreEnv(stashed);
    }
  });

  it('returns undefined when no auth env is set', () => {
    const stashed = stashEnv();
    try {
      delete process.env.ELASTICSEARCH_API_KEY;
      delete process.env.ELASTICSEARCH_USERNAME;
      delete process.env.ELASTICSEARCH_PASSWORD;
      expect(readElasticsearchAuthFromEnv()).toBeUndefined();
    } finally {
      restoreEnv(stashed);
    }
  });
});
