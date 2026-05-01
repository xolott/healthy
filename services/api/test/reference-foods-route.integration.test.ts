import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { foodLogEntries, pantryItems, referenceFoods, users } from '@healthy/db/schema';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';

import { buildApp } from '../src/app.js';
import * as esEnv from '../src/reference-food/search/create-elasticsearch-client.js';
import {
  insertPersistedReferenceFood,
  insertPersistedUserWithBearerSession,
  INTEGRATION_TEST_PLAIN_PASSWORD,
} from './helpers/persisted-builders.js';

describe('Reference Food routes (integration)', () => {
  let harness: PostgresTestDatabase;

  beforeAll(async () => {
    harness = await startPostgresTestDatabase();
  });

  afterAll(async () => {
    await harness.dispose();
  });

  beforeEach(async () => {
    await harness.db.delete(foodLogEntries);
    await harness.db.delete(referenceFoods);
    await harness.db.delete(pantryItems);
    await harness.db.delete(users);
    vi.stubEnv('DATABASE_URL', harness.connectionUri);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated Reference Food search', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/reference-foods/search?q=ab',
        headers: { accept: 'application/json' },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.payload)).toEqual({ error: 'unauthorized' });
    } finally {
      await app.close();
    }
  });

  it('returns 503 for search when ELASTICSEARCH_URL is unset (Pantry reference still works)', async () => {
    const { authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'rf-es-off@example.com',
      displayName: 'RF Tester',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });
    vi.stubEnv('ELASTICSEARCH_URL', '');
    const app = await buildApp();
    try {
      const pantryRef = await app.inject({
        method: 'GET',
        url: '/pantry/reference',
        headers: authHeaders,
      });
      expect(pantryRef.statusCode).toBe(200);

      const searchRes = await app.inject({
        method: 'GET',
        url: '/reference-foods/search?q=ab',
        headers: authHeaders,
      });
      expect(searchRes.statusCode).toBe(503);
      expect(JSON.parse(searchRes.payload)).toEqual({ error: 'service_unavailable' });
    } finally {
      await app.close();
    }
  });

  it('hydrates search hits from Postgres in Elasticsearch score order', async () => {
    const { authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'rf-hydrate@example.com',
      displayName: 'Hydrate',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });

    const first = await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'fdc-first',
      displayName: 'AAA First Food',
      brand: null,
      foodClass: 'survey',
      baseAmountGrams: 100,
      calories: 10,
      proteinGrams: 1,
      fatGrams: 0,
      carbohydratesGrams: 2,
      servings: [{ label: '100 g', gramWeight: 100 }],
    });

    const second = await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'fdc-second',
      displayName: 'BBB Second Food',
      brand: 'TestBrand',
      foodClass: 'branded',
      baseAmountGrams: 50,
      calories: 25,
      proteinGrams: 2,
      fatGrams: 1,
      carbohydratesGrams: 3,
      servings: [],
    });

    vi.stubEnv('ELASTICSEARCH_URL', 'http://127.0.0.1:9200');

    const mockSearch = vi.fn().mockResolvedValue({
      hits: {
        hits: [
          { _source: { referenceFoodId: second.id } },
          { _source: { referenceFoodId: first.id } },
        ],
      },
    });

    vi.spyOn(esEnv, 'createElasticsearchClientFromEnv').mockReturnValue({
      search: mockSearch,
    } as never);

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/reference-foods/search?q=oat',
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(mockSearch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(res.payload) as {
        items: Array<{
          id: string;
          displayName: string;
          brand: string | null;
          foodClass: string | null;
          servingPreview: { label: string; gramWeight: number | null } | null;
          macros: { baseAmountGrams: number; calories: number };
        }>;
      };
      expect(body.items).toHaveLength(2);
      expect(body.items[0]?.id).toBe(second.id);
      expect(body.items[0]?.displayName).toBe('BBB Second Food');
      expect(body.items[0]?.brand).toBe('TestBrand');
      expect(body.items[0]?.foodClass).toBe('branded');
      expect(body.items[0]?.servingPreview).toBeNull();
      expect(body.items[1]?.id).toBe(first.id);
      expect(body.items[1]?.servingPreview).toEqual({ label: '100 g', gramWeight: 100 });
      expect(body.items[1]?.macros.baseAmountGrams).toBe(100);
    } finally {
      await app.close();
    }
  });

  it('omits inactive Reference Foods from hydrated search results', async () => {
    const { authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'rf-inactive-search@example.com',
      displayName: 'Inactive Search',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });

    const inactive = await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'fdc-inactive',
      displayName: 'Inactive Catalog Row',
      baseAmountGrams: 100,
      calories: 1,
      proteinGrams: 0,
      fatGrams: 0,
      carbohydratesGrams: 0,
      isActive: false,
    });

    vi.stubEnv('ELASTICSEARCH_URL', 'http://127.0.0.1:9200');
    vi.spyOn(esEnv, 'createElasticsearchClientFromEnv').mockReturnValue({
      search: vi.fn().mockResolvedValue({
        hits: {
          hits: [{ _source: { referenceFoodId: inactive.id } }],
        },
      }),
    } as never);

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/reference-foods/search?q=xx',
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload)).toEqual({ items: [] });
    } finally {
      await app.close();
    }
  });

  it('returns 503 when Elasticsearch client search throws', async () => {
    const { authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'rf-es-throw@example.com',
      displayName: 'ES Throw',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });

    await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'fdc-es-throw',
      displayName: 'Throw RF',
      baseAmountGrams: 100,
      calories: 1,
      proteinGrams: 0,
      fatGrams: 0,
      carbohydratesGrams: 0,
    });

    vi.stubEnv('ELASTICSEARCH_URL', 'http://127.0.0.1:9200');
    vi.spyOn(esEnv, 'createElasticsearchClientFromEnv').mockReturnValue({
      search: vi.fn().mockRejectedValue(new Error('cluster unreachable')),
    } as never);

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/reference-foods/search?q=zz',
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
    } finally {
      await app.close();
    }
  });

  it('returns 400 when search text is shorter than 2 characters', async () => {
    const { authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'rf-short-q@example.com',
      displayName: 'Short Q',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });

    vi.stubEnv('ELASTICSEARCH_URL', 'http://127.0.0.1:9200');

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/reference-foods/search?q=x',
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload) as { error: string; field: string };
      expect(body.error).toBe('invalid_input');
      expect(body.field).toBe('q');
    } finally {
      await app.close();
    }
  });

  it('returns Reference Food detail for active rows and 404 for inactive', async () => {
    const { authHeaders } = await insertPersistedUserWithBearerSession(harness.db, {
      email: 'rf-detail@example.com',
      displayName: 'Detail',
      role: 'owner',
      status: 'active',
      plainPassword: INTEGRATION_TEST_PLAIN_PASSWORD,
    });

    const active = await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'fdc-active-detail',
      displayName: 'Active RF',
      brand: 'B',
      baseAmountGrams: 100,
      calories: 10,
      proteinGrams: 1,
      fatGrams: 0,
      carbohydratesGrams: 2,
      servings: [{ label: '1 tbsp', gramWeight: 15 }],
    });

    const inactive = await insertPersistedReferenceFood(harness.db, {
      source: 'usda_fdc',
      sourceFoodId: 'fdc-inactive-detail',
      displayName: 'Inactive RF',
      baseAmountGrams: 100,
      calories: 1,
      proteinGrams: 0,
      fatGrams: 0,
      carbohydratesGrams: 0,
      isActive: false,
    });

    const app = await buildApp();
    try {
      const okRes = await app.inject({
        method: 'GET',
        url: `/reference-foods/${active.id}`,
        headers: authHeaders,
      });
      expect(okRes.statusCode).toBe(200);
      const okBody = JSON.parse(okRes.payload) as {
        food: { id: string; displayName: string; servings: unknown[]; rawPayload: unknown };
      };
      expect(okBody.food.id).toBe(active.id);
      expect(okBody.food.displayName).toBe('Active RF');
      expect(okBody.food.servings).toEqual([{ label: '1 tbsp', gramWeight: 15 }]);

      const missingRes = await app.inject({
        method: 'GET',
        url: '/reference-foods/550e8400-e29b-41d4-a716-446655440099',
        headers: authHeaders,
      });
      expect(missingRes.statusCode).toBe(404);

      const inactiveRes = await app.inject({
        method: 'GET',
        url: `/reference-foods/${inactive.id}`,
        headers: authHeaders,
      });
      expect(inactiveRes.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('rejects unauthenticated Reference Food detail reads', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/reference-foods/550e8400-e29b-41d4-a716-446655440000',
        headers: { accept: 'application/json' },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
