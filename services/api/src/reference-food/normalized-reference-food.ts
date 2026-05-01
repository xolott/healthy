/**
 * Source-agnostic shape produced by reference-food importers before persistence.
 * Matches Reference Food domain concepts in CONTEXT.md (not necessarily 1:1 DB columns).
 */
export const REFERENCE_FOOD_SOURCE_USDA_FDC = 'usda_fdc' as const;

export type ReferenceFoodSourceKey = typeof REFERENCE_FOOD_SOURCE_USDA_FDC;

export type NormalizedReferenceFoodNutrients = {
  /** Kilocalories for `baseAmountGrams`, when the source provides them. */
  caloriesKcal: number | null;
  proteinGrams: number | null;
  fatGrams: number | null;
  carbohydratesGrams: number | null;
};

export type NormalizedReferenceFoodServing = {
  /** Portion label from the source (e.g. household description). */
  label: string;
  /** Gram weight for this portion when the source reports it. */
  gramWeight: number | null;
};

export type NormalizedReferenceFood = {
  source: ReferenceFoodSourceKey;
  sourceFoodId: string;
  displayName: string;
  brand: string | null;
  foodClass: string | null;
  /** Amount of food, in grams, that `nutrients` are expressed for. */
  baseAmountGrams: number;
  nutrients: NormalizedReferenceFoodNutrients;
  servings: NormalizedReferenceFoodServing[];
  /**
   * Nutrient rows as returned by the provider (deep clone), for future remapping.
   */
  rawNutrients: unknown[];
  /** Full provider record (deep clone), for auditing and reprocessing. */
  rawPayload: Record<string, unknown>;
};
