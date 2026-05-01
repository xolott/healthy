import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  foodLogEntries,
  pantryItems,
  referenceFoodImportRuns,
  referenceFoods,
  users,
} from '@healthy/db/schema';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';
import { eq } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import { importUsdaJsonReferenceFoodsWithRecords } from '../src/reference-food/import/run-usda-json-reference-food-import.js';
import {
  asyncIterate,
  collectFoodRecordsFromUsdaFdcJsonRoot,
} from '../src/reference-food/import/stream-usda-fdc-json-foods.js';
import { REFERENCE_FOOD_SOURCE_USDA_FDC } from '../src/reference-food/normalized-reference-food.js';
import * as esEnv from '../src/reference-food/search/create-elasticsearch-client.js';
import {
  ReferenceFoodSearchReindexError,
  reindexReferenceFoodsFromPostgres,
} from '../src/reference-food/search/reindex-reference-foods-from-postgres.js';
import type { ReferenceFoodSearchIndexerClient } from '../src/reference-food/search/reference-food-search-indexer-client.js';
import {
  insertPersistedUserWithBearerSession,
  INTEGRATION_TEST_PLAIN_PASSWORD,
} from './helpers/persisted-builders.js';

function macroNutrient(id: number, number: string, name: string, unitName: string, amount: number) {
  return {
    nutrient: { id, number, name, rank: 1, unitName },
    amount,
  };
}

function brandedFoodFixture(fdcId: number, description: string) {
  return {
    fdcId,
    dataType: 'Branded',
    description,
    brandName: 'Flow Brand',
    foodNutrients: [
      macroNutrient(1008, '208', 'Energy', 'KCAL', 90),
      macroNutrient(1003, '203', 'Protein', 'G', 4),
      macroNutrient(1004, '204', 'Total lipid (fat)', 'G', 1),
      macroNutrient(1005, '205', 'Carbohydrate, by difference', 'G', 18),
    ],
    foodPortions: [{ portionDescription: '1 cup', gramWeight: 240 }],
  };
}

type RecordingIndexer = ReferenceFoodSearchIndexerClient & {
  records: {
    indexedIds: string[];
    bulkCalls: number;
    aliasActions: Array<{ add?: unknown; remove?: unknown }>;
  };
};

function createRecordingIndexerClient(options: { bulkErrors?: boolean }): RecordingIndexer {
  const records = {
    indexedIds: [] as string[],
    bulkCalls: 0,
    aliasActions: [] as Array<{ add?: unknown; remove?: unknown }>,
  };

  const client: RecordingIndexer = {
    records,
    async indicesCreate() {},
    async indicesGetAlias() {
      return [];
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

describe('Reference Food operational flow (integration)', () => {
  let harness: PostgresTestDatabase;

  beforeAll(async () => {
    harness = await startPostgresTestDatabase();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  beforeEach(async () => {
    await harness.db.delete(foodLogEntries);
    await harness.db.delete(referenceFoodImportRuns);
    await harness.db.delete(referenceFoods);
    await harness.db.delete(pantryItems);
    await harness.db.delete(users);
    vi.stubEnv('DATABASE_URL', harness.connectionUri);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('runs import, reindex, search, detail, log, and day list against Postgres + mocked Elasticsearch', async () => {
    const root = { BrandedFoods: [brandedFoodFixture(7701, 'Flow Day Oats')] };
    await importUsdaJsonReferenceFoodsWithRecords({
      db: harness.db,
      source: REFERENCE_FOOD_SOURCE_USDA_FDC,
      sourceVersion: 'op-flow-1',
      fileHash: 'op-flow-hash-1',
      records: asyncIterate(collectFoodRecordsFromUsdaFdcJsonRoot(root)),
    });

    const reindexClient = createRecordingIndexerClient({});
    await reindexReferenceFoodsFromPostgres({
      db: harness.db,
      client: reindexClient,
      aliasName: 'reference_foods_search',
      newIndexName: 'reference_foods_search_v_op_flow',
      batchSize: 50,
    });

    const [row] = await harness.db
      .select()
      .from(referenceFoods)
      .where(eq(referenceFoods.sourceFoodId, '7701'))
      .limit(1);
    if (row === undefined) {
      throw new Error('expected imported reference food');
    }
    expect(reindexClient.records.indexedIds).toEqual([row.id]);

    const { authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'op-flow@example.com',
      displayName: 'Op Flow',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });

    vi.stubEnv('ELASTICSEARCH_URL', 'http://127.0.0.1:9200');
    vi.spyOn(esEnv, 'createElasticsearchClientFromEnv').mockReturnValue({
      search: vi.fn().mockResolvedValue({
        hits: {
          hits: [{ _source: { referenceFoodId: row.id } }],
        },
      }),
    } as never);

    const app = await buildApp();
    try {
      const searchRes = await app.inject({
        method: 'GET',
        url: '/reference-foods/search?q=oats',
        headers: authHeaders,
      });
      expect(searchRes.statusCode).toBe(200);
      const searchBody = JSON.parse(searchRes.payload) as { items: Array<{ id: string }> };
      expect(searchBody.items).toHaveLength(1);
      expect(searchBody.items[0]?.id).toBe(row.id);

      const detailRes = await app.inject({
        method: 'GET',
        url: `/reference-foods/${row.id}`,
        headers: authHeaders,
      });
      expect(detailRes.statusCode).toBe(200);
      const detailBody = JSON.parse(detailRes.payload) as { food: { displayName: string } };
      expect(detailBody.food.displayName).toBe('Flow Day Oats');

      const batchRes = await app.inject({
        method: 'POST',
        url: '/food-log/entries/batch',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        payload: JSON.stringify({
          consumedAt: '2026-04-30T18:00:00.000Z',
          consumedDate: '2026-04-30',
          entries: [{ referenceFoodId: row.id, grams: 120 }],
        }),
      });
      expect(batchRes.statusCode).toBe(201);
      const batchBody = JSON.parse(batchRes.payload) as { entries: unknown[] };

      const listRes = await app.inject({
        method: 'GET',
        url: '/food-log/entries?date=2026-04-30',
        headers: authHeaders,
      });
      expect(listRes.statusCode).toBe(200);
      expect(JSON.parse(listRes.payload)).toEqual({ entries: batchBody.entries });
    } finally {
      await app.close();
    }
  });

  it('repairs Elasticsearch projection after bulk failure once import left Postgres authoritative', async () => {
    const root = { BrandedFoods: [brandedFoodFixture(7702, 'Repair After Import')] };
    await importUsdaJsonReferenceFoodsWithRecords({
      db: harness.db,
      source: REFERENCE_FOOD_SOURCE_USDA_FDC,
      sourceVersion: 'op-flow-2',
      fileHash: 'op-flow-hash-2',
      records: asyncIterate(collectFoodRecordsFromUsdaFdcJsonRoot(root)),
    });

    const bad = createRecordingIndexerClient({ bulkErrors: true });
    await expect(
      reindexReferenceFoodsFromPostgres({
        db: harness.db,
        client: bad,
        newIndexName: 'reference_foods_search_v_op_fail',
        batchSize: 20,
      }),
    ).rejects.toThrow(ReferenceFoodSearchReindexError);

    const good = createRecordingIndexerClient({});
    const summary = await reindexReferenceFoodsFromPostgres({
      db: harness.db,
      client: good,
      newIndexName: 'reference_foods_search_v_op_ok',
      batchSize: 20,
    });

    const [row] = await harness.db
      .select({ id: referenceFoods.id })
      .from(referenceFoods)
      .where(eq(referenceFoods.sourceFoodId, '7702'))
      .limit(1);
    if (row === undefined) {
      throw new Error('expected imported reference food');
    }

    expect(summary.indexedDocuments).toBe(1);
    expect(good.records.indexedIds).toEqual([row.id]);
  });
});
