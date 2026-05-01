import { createReadStream } from 'node:fs';
import { Transform } from 'node:stream';

import type { Hash } from 'node:crypto';

import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import pick from 'stream-json/filters/pick.js';
import streamValues from 'stream-json/streamers/stream-values.js';

/**
 * Paths under typical FoodData Central bulk JSON exports whose values are
 * individual food objects (streaming one element at a time).
 */
const USDA_FDC_BATCH_ARRAY_ELEMENT_PATH =
  /^(BrandedFoods|FoundationFoods|SRLegacyFoods|SurveyFoods|FNDDSFoods)\.\d+$/;

export function createSha256Passthrough(hash: Hash): Transform {
  return new Transform({
    transform(chunk: Buffer, _enc, cb): void {
      hash.update(chunk);
      cb(null, chunk);
    },
  });
}

/**
 * Streams food-shaped JSON objects from a USDA FDC bulk file while updating the
 * given SHA-256 hash with the raw bytes (single pass).
 */
export async function* streamUsdaFdcFoodObjectsFromFile(
  filePath: string,
  hash: Hash,
): AsyncGenerator<unknown, void, undefined> {
  const pipeline = chain([
    createReadStream(filePath),
    createSha256Passthrough(hash),
    parser(),
    pick({ filter: USDA_FDC_BATCH_ARRAY_ELEMENT_PATH }),
    streamValues(),
  ]);

  for await (const chunk of pipeline as AsyncIterable<{ key: number; value: unknown }>) {
    yield chunk.value;
  }
}

/**
 * Test helper: collect objects from an already-parsed root without streaming.
 */
export function collectFoodRecordsFromUsdaFdcJsonRoot(root: unknown): unknown[] {
  if (Array.isArray(root)) {
    return [...root];
  }
  if (!root || typeof root !== 'object') {
    return [];
  }
  const keys = [
    'BrandedFoods',
    'FoundationFoods',
    'SRLegacyFoods',
    'SurveyFoods',
    'FNDDSFoods',
  ] as const;
  const out: unknown[] = [];
  const obj = root as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) {
      out.push(...v);
    }
  }
  return out;
}

export async function* asyncIterate<T>(items: readonly T[]): AsyncGenerator<T, void, undefined> {
  for (const x of items) {
    yield x;
  }
}
