import { createHash } from 'node:crypto';

import {
  referenceFoodImportKeys,
  referenceFoodImportRuns,
  referenceFoods,
} from '@healthy/db/schema';
import { and, eq, notExists, sql } from 'drizzle-orm';

import type { Database } from '@healthy/db/client';

import { REFERENCE_FOOD_SOURCE_USDA_FDC } from '../normalized-reference-food.js';
import { normalizeUsdaFdcFood } from '../usda-fdc/index.js';
import {
  advisoryLockIntsForReferenceFoodSource,
  releaseReferenceFoodImportLock,
  tryAcquireReferenceFoodImportLock,
} from './reference-food-import-lock.js';
import { streamUsdaFdcFoodObjectsFromFile } from './stream-usda-fdc-json-foods.js';

const STAGING_BATCH = 250;

export class ReferenceFoodImportLockUnavailableError extends Error {
  constructor(source: string) {
    super(`Another reference food import is already in progress for source "${source}".`);
    this.name = 'ReferenceFoodImportLockUnavailableError';
  }
}

export class ReferenceFoodImportUnsupportedSourceError extends Error {
  constructor(expected: string, actual: string) {
    super(`This importer expects source "${expected}" but received "${actual}".`);
    this.name = 'ReferenceFoodImportUnsupportedSourceError';
  }
}

export type UsdaJsonReferenceFoodImportSummary = {
  importRunId: string;
  fileHash: string;
  recordsRead: number;
  recordsUpserted: number;
  recordsSkippedInvalid: number;
  recordsDeactivated: number;
};

async function flushImportKeys(db: Database, runId: string, buffer: string[]): Promise<void> {
  if (buffer.length === 0) {
    return;
  }
  await db
    .insert(referenceFoodImportKeys)
    .values(buffer.map((sourceFoodId) => ({ importRunId: runId, sourceFoodId })))
    .onConflictDoNothing();
  buffer.length = 0;
}

async function markImportRunFailed(
  db: Database,
  runId: string,
  summary: {
    recordsRead: number;
    recordsUpserted: number;
    recordsSkippedInvalid: number;
    errorMessage: string;
  },
): Promise<void> {
  await db
    .delete(referenceFoodImportKeys)
    .where(eq(referenceFoodImportKeys.importRunId, runId));
  await db
    .update(referenceFoodImportRuns)
    .set({
      status: 'failed',
      finishedAt: new Date(),
      errorSummary: summary.errorMessage.slice(0, 2000),
      recordsRead: summary.recordsRead,
      recordsUpserted: summary.recordsUpserted,
      recordsSkippedInvalid: summary.recordsSkippedInvalid,
    })
    .where(eq(referenceFoodImportRuns.id, runId));
}

/**
 * Operator import for USDA FoodData Central bulk JSON: streams the file in one
 * pass (hash + parse), upserts active Reference Foods, then marks rows missing
 * from the snapshot inactive.
 */
export async function importUsdaJsonReferenceFoods(params: {
  db: Database;
  source: string;
  sourceVersion: string;
  filePath: string;
}): Promise<UsdaJsonReferenceFoodImportSummary> {
  const sha256 = createHash('sha256');
  const records = streamUsdaFdcFoodObjectsFromFile(params.filePath, sha256);
  return runUsdaJsonReferenceFoodImport({
    db: params.db,
    source: params.source,
    sourceVersion: params.sourceVersion,
    records,
    resolveFileHash: () => sha256.digest('hex'),
  });
}

/**
 * Same as {@link importUsdaJsonReferenceFoods} but accepts pre-parsed records
 * (e.g. tests) and a known file hash.
 */
export async function importUsdaJsonReferenceFoodsWithRecords(params: {
  db: Database;
  source: string;
  sourceVersion: string;
  fileHash: string;
  records: AsyncIterable<unknown>;
}): Promise<UsdaJsonReferenceFoodImportSummary> {
  const { fileHash } = params;
  return runUsdaJsonReferenceFoodImport({
    db: params.db,
    source: params.source,
    sourceVersion: params.sourceVersion,
    records: params.records,
    resolveFileHash: () => fileHash,
  });
}

async function runUsdaJsonReferenceFoodImport(options: {
  db: Database;
  source: string;
  sourceVersion: string;
  records: AsyncIterable<unknown>;
  resolveFileHash: () => string;
}): Promise<UsdaJsonReferenceFoodImportSummary> {
  const { db, source, sourceVersion, records, resolveFileHash } = options;

  if (source !== REFERENCE_FOOD_SOURCE_USDA_FDC) {
    throw new ReferenceFoodImportUnsupportedSourceError(REFERENCE_FOOD_SOURCE_USDA_FDC, source);
  }

  const lockKeys = advisoryLockIntsForReferenceFoodSource(source);
  let runRowId: string | undefined;
  let recordsRead = 0;
  let recordsUpserted = 0;
  let recordsSkippedInvalid = 0;
  let lockHeld = false;

  try {
    const locked = await tryAcquireReferenceFoodImportLock(db, lockKeys);
    if (!locked) {
      throw new ReferenceFoodImportLockUnavailableError(source);
    }
    lockHeld = true;

    const [runRow] = await db
      .insert(referenceFoodImportRuns)
      .values({
        source,
        sourceVersion,
        fileHash: 'pending',
        status: 'running',
      })
      .returning({ id: referenceFoodImportRuns.id });

    if (runRow === undefined) {
      throw new Error('reference food import run insert did not return a row');
    }
    runRowId = runRow.id;

    const keyBuffer: string[] = [];

    for await (const raw of records) {
      recordsRead += 1;
      const normalized = normalizeUsdaFdcFood(raw);
      if (normalized.kind !== 'ok') {
        recordsSkippedInvalid += 1;
        continue;
      }

      const v = normalized.value;
      const now = new Date();
      await db
        .insert(referenceFoods)
        .values({
          source: v.source,
          sourceFoodId: v.sourceFoodId,
          displayName: v.displayName,
          brand: v.brand,
          foodClass: v.foodClass,
          baseAmountGrams: v.baseAmountGrams,
          calories: v.nutrients.caloriesKcal ?? 0,
          proteinGrams: v.nutrients.proteinGrams ?? 0,
          fatGrams: v.nutrients.fatGrams ?? 0,
          carbohydratesGrams: v.nutrients.carbohydratesGrams ?? 0,
          servings: v.servings,
          rawNutrients: v.rawNutrients,
          rawPayload: v.rawPayload,
          iconKey: 'food_bowl',
          isActive: true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [referenceFoods.source, referenceFoods.sourceFoodId],
          set: {
            displayName: sql`excluded.display_name`,
            brand: sql`excluded.brand`,
            foodClass: sql`excluded.food_class`,
            baseAmountGrams: sql`excluded.base_amount_grams`,
            calories: sql`excluded.calories`,
            proteinGrams: sql`excluded.protein_grams`,
            fatGrams: sql`excluded.fat_grams`,
            carbohydratesGrams: sql`excluded.carbohydrates_grams`,
            servings: sql`excluded.servings`,
            rawNutrients: sql`excluded.raw_nutrients`,
            rawPayload: sql`excluded.raw_payload`,
            iconKey: sql`excluded.icon_key`,
            isActive: sql`excluded.is_active`,
            updatedAt: now,
          },
        });

      recordsUpserted += 1;
      keyBuffer.push(v.sourceFoodId);
      if (keyBuffer.length >= STAGING_BATCH) {
        await flushImportKeys(db, runRowId, keyBuffer);
      }
    }

    await flushImportKeys(db, runRowId, keyBuffer);

    const deactivatedRows = await db
      .update(referenceFoods)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(referenceFoods.source, source),
          eq(referenceFoods.isActive, true),
          notExists(
            db
              .select({ one: sql`1` })
              .from(referenceFoodImportKeys)
              .where(
                and(
                  eq(referenceFoodImportKeys.importRunId, runRowId),
                  eq(referenceFoodImportKeys.sourceFoodId, referenceFoods.sourceFoodId),
                ),
              ),
          ),
        ),
      )
      .returning({ id: referenceFoods.id });

    await db
      .delete(referenceFoodImportKeys)
      .where(eq(referenceFoodImportKeys.importRunId, runRowId));

    const fileHash = resolveFileHash();

    await db
      .update(referenceFoodImportRuns)
      .set({
        fileHash,
        recordsRead,
        recordsUpserted,
        recordsSkippedInvalid,
        recordsDeactivated: deactivatedRows.length,
        status: 'succeeded',
        finishedAt: new Date(),
      })
      .where(eq(referenceFoodImportRuns.id, runRowId));

    return {
      importRunId: runRowId,
      fileHash,
      recordsRead,
      recordsUpserted,
      recordsSkippedInvalid,
      recordsDeactivated: deactivatedRows.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runRowId !== undefined) {
      await markImportRunFailed(db, runRowId, {
        recordsRead,
        recordsUpserted,
        recordsSkippedInvalid,
        errorMessage: message,
      });
    }
    throw err;
  } finally {
    if (lockHeld) {
      await releaseReferenceFoodImportLock(db, lockKeys);
    }
  }
}
