import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  foodLogEntries,
  pantryItems,
  referenceFoodImportRuns,
  referenceFoods,
  users,
} from '@healthy/db/schema';
import { createDatabaseAdapter } from '@healthy/db/client';
import { startPostgresTestDatabase, type PostgresTestDatabase } from '@healthy/db/test';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { REFERENCE_FOOD_SOURCE_USDA_FDC } from '../src/reference-food/normalized-reference-food.js';
import {
  advisoryLockIntsForReferenceFoodSource,
  releaseReferenceFoodImportLock,
  tryAcquireReferenceFoodImportLock,
} from '../src/reference-food/import/reference-food-import-lock.js';
import {
  asyncIterate,
  collectFoodRecordsFromUsdaFdcJsonRoot,
} from '../src/reference-food/import/stream-usda-fdc-json-foods.js';
import {
  importUsdaJsonReferenceFoods,
  importUsdaJsonReferenceFoodsWithRecords,
  ReferenceFoodImportLockUnavailableError,
} from '../src/reference-food/import/run-usda-json-reference-food-import.js';

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
    brandName: 'Test Brand',
    foodNutrients: [
      macroNutrient(1008, '208', 'Energy', 'KCAL', 100),
      macroNutrient(1003, '203', 'Protein', 'G', 5),
      macroNutrient(1004, '204', 'Total lipid (fat)', 'G', 2),
      macroNutrient(1005, '205', 'Carbohydrate, by difference', 'G', 10),
    ],
    foodPortions: [{ portionDescription: '1 cup', gramWeight: 240 }],
  };
}

describe('USDA JSON Reference Food import (integration)', () => {
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
  });

  it('streams a USDA-style JSON file with one pass hashing and upserts rows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'healthy-usda-import-'));
    const filePath = join(dir, 'sample.json');
    const payload = {
      BrandedFoods: [brandedFoodFixture(501, 'First Food'), brandedFoodFixture(502, 'Second Food')],
    };
    const body = JSON.stringify(payload);
    writeFileSync(filePath, body, 'utf8');
    const expectedHash = createHash('sha256').update(body, 'utf8').digest('hex');

    try {
      const summary = await importUsdaJsonReferenceFoods({
        db: harness.db,
        source: REFERENCE_FOOD_SOURCE_USDA_FDC,
        sourceVersion: 'test-v1',
        filePath,
      });

      expect(summary.fileHash).toBe(expectedHash);
      expect(summary.recordsRead).toBe(2);
      expect(summary.recordsUpserted).toBe(2);
      expect(summary.recordsSkippedInvalid).toBe(0);

      const rows = await harness.db
        .select()
        .from(referenceFoods)
        .where(eq(referenceFoods.source, REFERENCE_FOOD_SOURCE_USDA_FDC));
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.isActive)).toBe(true);
      expect(rows.every((r) => Array.isArray(r.rawNutrients))).toBe(true);
      expect(rows.every((r) => typeof r.rawPayload === 'object')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reimports the same ids without duplicating rows', async () => {
    const root = {
      BrandedFoods: [brandedFoodFixture(901, 'Original'), brandedFoodFixture(902, 'Other')],
    };
    const records = collectFoodRecordsFromUsdaFdcJsonRoot(root);

    await importUsdaJsonReferenceFoodsWithRecords({
      db: harness.db,
      source: REFERENCE_FOOD_SOURCE_USDA_FDC,
      sourceVersion: 't1',
      fileHash: 'hash-one',
      records: asyncIterate(records),
    });

    const updatedRoot = {
      BrandedFoods: [
        brandedFoodFixture(901, 'Renamed'),
        brandedFoodFixture(902, 'Other'),
      ],
    };

    await importUsdaJsonReferenceFoodsWithRecords({
      db: harness.db,
      source: REFERENCE_FOOD_SOURCE_USDA_FDC,
      sourceVersion: 't2',
      fileHash: 'hash-two',
      records: asyncIterate(collectFoodRecordsFromUsdaFdcJsonRoot(updatedRoot)),
    });

    const rows = await harness.db
      .select()
      .from(referenceFoods)
      .where(eq(referenceFoods.source, REFERENCE_FOOD_SOURCE_USDA_FDC));

    expect(rows).toHaveLength(2);
    const one = rows.find((r) => r.sourceFoodId === '901');
    expect(one?.displayName).toBe('Renamed');
  });

  it('marks foods missing from a later snapshot inactive', async () => {
    const full = {
      BrandedFoods: [brandedFoodFixture(201, 'Keep'), brandedFoodFixture(202, 'Drop later')],
    };
    await importUsdaJsonReferenceFoodsWithRecords({
      db: harness.db,
      source: REFERENCE_FOOD_SOURCE_USDA_FDC,
      sourceVersion: 'snap-a',
      fileHash: 'aaa',
      records: asyncIterate(collectFoodRecordsFromUsdaFdcJsonRoot(full)),
    });

    const subset = { BrandedFoods: [brandedFoodFixture(201, 'Keep')] };
    const summary = await importUsdaJsonReferenceFoodsWithRecords({
      db: harness.db,
      source: REFERENCE_FOOD_SOURCE_USDA_FDC,
      sourceVersion: 'snap-b',
      fileHash: 'bbb',
      records: asyncIterate(collectFoodRecordsFromUsdaFdcJsonRoot(subset)),
    });

    expect(summary.recordsDeactivated).toBe(1);

    const rows = await harness.db
      .select()
      .from(referenceFoods)
      .where(eq(referenceFoods.source, REFERENCE_FOOD_SOURCE_USDA_FDC));

    const keep = rows.find((r) => r.sourceFoodId === '201');
    const dropped = rows.find((r) => r.sourceFoodId === '202');
    expect(keep?.isActive).toBe(true);
    expect(dropped?.isActive).toBe(false);
  });

  it('fails fast when a Postgres advisory lock is already held for the source', async () => {
    const keys = advisoryLockIntsForReferenceFoodSource(REFERENCE_FOOD_SOURCE_USDA_FDC);
    const first = createDatabaseAdapter(harness.connectionUri, { max: 1 });
    const second = createDatabaseAdapter(harness.connectionUri, { max: 1 });
    try {
      expect(await tryAcquireReferenceFoodImportLock(first.db, keys)).toBe(true);
      expect(await tryAcquireReferenceFoodImportLock(second.db, keys)).toBe(false);

      const pending = importUsdaJsonReferenceFoodsWithRecords({
        db: second.db,
        source: REFERENCE_FOOD_SOURCE_USDA_FDC,
        sourceVersion: 'blocked',
        fileHash: 'blocked-hash',
        records: asyncIterate([brandedFoodFixture(77, 'Blocked')]),
      });
      await expect(pending).rejects.toBeInstanceOf(ReferenceFoodImportLockUnavailableError);
    } finally {
      await releaseReferenceFoodImportLock(first.db, keys);
      await first.close();
      await second.close();
    }
  });
});
