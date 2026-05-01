import type { ReferenceFoodRow } from '@healthy/db/schema';

/** Stable alias operators target for reads; underlying concrete index is versioned. */
export const REFERENCE_FOOD_SEARCH_ALIAS_DEFAULT = 'reference_foods_search';

/**
 * Maps an authoritative Postgres Reference Food row to an Elasticsearch document
 * for weighted name/brand search and result cards.
 */
export function referenceFoodRowToSearchDocument(
  row: ReferenceFoodRow,
): Record<string, unknown> {
  return {
    referenceFoodId: row.id,
    source: row.source,
    sourceFoodId: row.sourceFoodId,
    displayName: row.displayName,
    brand: row.brand ?? '',
    foodClass: row.foodClass ?? '',
    iconKey: row.iconKey,
    baseAmountGrams: row.baseAmountGrams,
    calories: row.calories,
    proteinGrams: row.proteinGrams,
    fatGrams: row.fatGrams,
    carbohydratesGrams: row.carbohydratesGrams,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Index mapping: text fields for search/boosting; keywords for filtering and ids.
 */
export function referenceFoodSearchIndexMappingsProperties(): Record<string, unknown> {
  return {
    referenceFoodId: { type: 'keyword' },
    source: { type: 'keyword' },
    sourceFoodId: { type: 'keyword' },
    displayName: {
      type: 'text',
      analyzer: 'standard',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
      },
    },
    brand: {
      type: 'text',
      analyzer: 'standard',
      fields: {
        keyword: { type: 'keyword', ignore_above: 256 },
      },
    },
    foodClass: { type: 'keyword' },
    iconKey: { type: 'keyword' },
    baseAmountGrams: { type: 'double' },
    calories: { type: 'double' },
    proteinGrams: { type: 'double' },
    fatGrams: { type: 'double' },
    carbohydratesGrams: { type: 'double' },
    updatedAt: { type: 'date' },
  };
}
