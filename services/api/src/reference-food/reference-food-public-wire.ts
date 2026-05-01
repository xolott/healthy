import type { ReferenceFoodRow } from '@healthy/db/schema';

import type {
  ReferenceFoodDetailWire,
  ReferenceFoodMacrosWire,
  ReferenceFoodSearchCardWire,
  ReferenceFoodServingPreviewWire,
} from '../request-scope/types.js';

function macrosFromRow(row: ReferenceFoodRow): ReferenceFoodMacrosWire {
  return {
    baseAmountGrams: row.baseAmountGrams,
    calories: row.calories,
    proteinGrams: row.proteinGrams,
    fatGrams: row.fatGrams,
    carbohydratesGrams: row.carbohydratesGrams,
  };
}

function servingPreviewFromRow(row: ReferenceFoodRow): ReferenceFoodServingPreviewWire | null {
  const first = row.servings[0];
  if (first === undefined) {
    return null;
  }
  return {
    label: first.label,
    gramWeight: first.gramWeight,
  };
}

export function referenceFoodRowToSearchCard(row: ReferenceFoodRow): ReferenceFoodSearchCardWire {
  return {
    id: row.id,
    source: row.source,
    sourceFoodId: row.sourceFoodId,
    displayName: row.displayName,
    brand: row.brand,
    foodClass: row.foodClass,
    servingPreview: servingPreviewFromRow(row),
    macros: macrosFromRow(row),
  };
}

/**
 * Maps Elasticsearch hit order to hydrated cards, skipping unknown or inactive rows.
 */
export function mapOrderedIdsToSearchCards(
  orderedIds: string[],
  rowsById: Map<string, ReferenceFoodRow>,
): ReferenceFoodSearchCardWire[] {
  const cards: ReferenceFoodSearchCardWire[] = [];
  for (const id of orderedIds) {
    const row = rowsById.get(id);
    if (row === undefined || !row.isActive) {
      continue;
    }
    cards.push(referenceFoodRowToSearchCard(row));
  }
  return cards;
}

export function referenceFoodRowToDetailWire(row: ReferenceFoodRow): ReferenceFoodDetailWire {
  return {
    id: row.id,
    source: row.source,
    sourceFoodId: row.sourceFoodId,
    displayName: row.displayName,
    brand: row.brand,
    foodClass: row.foodClass,
    iconKey: row.iconKey,
    baseAmountGrams: row.baseAmountGrams,
    calories: row.calories,
    proteinGrams: row.proteinGrams,
    fatGrams: row.fatGrams,
    carbohydratesGrams: row.carbohydratesGrams,
    servings: row.servings.map((s) => ({
      label: s.label,
      gramWeight: s.gramWeight,
    })),
    rawNutrients: row.rawNutrients,
    rawPayload: row.rawPayload,
  };
}
