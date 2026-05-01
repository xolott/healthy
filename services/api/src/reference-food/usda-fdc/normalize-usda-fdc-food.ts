import {
  REFERENCE_FOOD_SOURCE_USDA_FDC,
  type NormalizedReferenceFood,
  type NormalizedReferenceFoodNutrients,
  type NormalizedReferenceFoodServing,
} from '../normalized-reference-food.js';

export type NormalizeUsdaFdcFoodResult =
  | { kind: 'ok'; value: NormalizedReferenceFood }
  | { kind: 'invalid_input'; message: string; field?: string };

const KJ_PER_KCAL = 4.184;

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pickBrand(f: Record<string, unknown>): string | null {
  const keys = ['brandName', 'brandOwner', 'tradeMarkBrandName', 'brand'] as const;
  for (const key of keys) {
    const v = f[key];
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
  }
  return null;
}

function pickFoodClass(f: Record<string, unknown>): string | null {
  if (typeof f.foodClass === 'string' && f.foodClass.trim().length > 0) {
    return f.foodClass.trim();
  }
  const branded = f.brandedFoodCategory;
  if (branded !== null && typeof branded === 'object') {
    const d = (branded as Record<string, unknown>).description;
    if (typeof d === 'string' && d.trim().length > 0) {
      return d.trim();
    }
  }
  const category = f.foodCategory;
  if (category !== null && typeof category === 'object') {
    const d = (category as Record<string, unknown>).description;
    if (typeof d === 'string' && d.trim().length > 0) {
      return d.trim();
    }
  }
  const wweia = f.wweiaFoodCategory;
  if (wweia !== null && typeof wweia === 'object') {
    const d = (wweia as Record<string, unknown>).wweiaFoodCategoryDescription;
    if (typeof d === 'string' && d.trim().length > 0) {
      return d.trim();
    }
  }
  return null;
}

function extractNutrients(rows: unknown): NormalizedReferenceFoodNutrients {
  const empty: NormalizedReferenceFoodNutrients = {
    caloriesKcal: null,
    proteinGrams: null,
    fatGrams: null,
    carbohydratesGrams: null,
  };
  if (!Array.isArray(rows)) {
    return empty;
  }

  let caloriesKcal: number | null = null;
  let proteinGrams: number | null = null;
  let fatGrams: number | null = null;
  let carbohydratesGrams: number | null = null;

  for (const row of rows) {
    if (row === null || typeof row !== 'object') {
      continue;
    }
    const r = row as Record<string, unknown>;
    const rawAmount = r.amount;
    if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount)) {
      continue;
    }

    let nutrientId: number | undefined;
    let numberStr: string | undefined;
    let unitUpper: string | undefined;
    let nameLower: string | undefined;

    const nutrient = r.nutrient;
    if (nutrient !== null && typeof nutrient === 'object') {
      const n = nutrient as Record<string, unknown>;
      if (typeof n.id === 'number') {
        nutrientId = n.id;
      }
      if (typeof n.number === 'string') {
        numberStr = n.number;
      }
      if (typeof n.unitName === 'string') {
        unitUpper = n.unitName.trim().toUpperCase();
      }
      if (typeof n.name === 'string') {
        nameLower = n.name.trim().toLowerCase();
      }
    }
    if (typeof r.nutrientId === 'number') {
      nutrientId = nutrientId ?? r.nutrientId;
    }

    const amount = rawAmount;

    const isEnergy =
      nutrientId === 1008 ||
      numberStr === '208' ||
      (nameLower !== undefined &&
        nameLower.includes('energy') &&
        !nameLower.includes('potassium'));

    if (caloriesKcal === null && isEnergy) {
      if (unitUpper === 'KJ') {
        caloriesKcal = amount / KJ_PER_KCAL;
      } else if (unitUpper === 'KCAL' || unitUpper === 'CAL' || unitUpper === undefined) {
        caloriesKcal = amount;
      }
    }

    const isProtein =
      nutrientId === 1003 || numberStr === '203' || nameLower?.includes('protein');
    if (proteinGrams === null && isProtein) {
      proteinGrams = amount;
    }

    const isFat =
      nutrientId === 1004 ||
      numberStr === '204' ||
      (nameLower?.includes('total lipid') ?? false) ||
      (nameLower?.includes('fat') && nameLower.includes('total'));

    if (fatGrams === null && isFat) {
      fatGrams = amount;
    }

    const isCarbs =
      nutrientId === 1005 ||
      numberStr === '205' ||
      (nameLower?.includes('carbohydrate') && nameLower.includes('difference'));

    if (carbohydratesGrams === null && isCarbs) {
      carbohydratesGrams = amount;
    }
  }

  return {
    caloriesKcal,
    proteinGrams,
    fatGrams,
    carbohydratesGrams,
  };
}

function inferBaseAmountGrams(f: Record<string, unknown>): number {
  const servingSize = f.servingSize;
  const servingUnit = f.servingSizeUnit;
  if (typeof servingSize === 'number' && Number.isFinite(servingSize) && servingSize > 0) {
    if (typeof servingUnit === 'string') {
      const u = servingUnit.trim().toLowerCase();
      if (u === 'g' || u === 'gram' || u === 'grams') {
        return servingSize;
      }
    }
  }
  return 100;
}

function extractServings(
  portions: unknown,
  baseAmountGrams: number,
): NormalizedReferenceFoodServing[] {
  const out: NormalizedReferenceFoodServing[] = [];
  if (Array.isArray(portions)) {
    for (const p of portions) {
      if (p === null || typeof p !== 'object') {
        continue;
      }
      const row = p as Record<string, unknown>;
      const gwRaw = row.gramWeight;
      const gramWeight =
        typeof gwRaw === 'number' && Number.isFinite(gwRaw) && gwRaw > 0 ? gwRaw : null;

      const desc = row.portionDescription;
      const modifier = row.modifier;
      const labelParts: string[] = [];
      if (typeof desc === 'string' && desc.trim().length > 0) {
        labelParts.push(desc.trim());
      }
      if (typeof modifier === 'string' && modifier.trim().length > 0) {
        labelParts.push(modifier.trim());
      }

      let label: string;
      if (labelParts.length > 0) {
        label = labelParts.join(' ');
      } else if (gramWeight !== null) {
        label = `${gramWeight} g`;
      } else {
        label = 'portion';
      }

      out.push({ label, gramWeight });
    }
  }

  const hasGramWeights = out.some((s) => s.gramWeight !== null);
  if (!hasGramWeights) {
    out.push({
      label: `${baseAmountGrams} g`,
      gramWeight: baseAmountGrams,
    });
  }

  return out;
}

/**
 * Maps a FoodData Central food JSON object into a normalized Reference Food.
 * Preserves `foodNutrients` and the full payload for future nutrient remapping.
 */
export function normalizeUsdaFdcFood(input: unknown): NormalizeUsdaFdcFoodResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { kind: 'invalid_input', message: 'Expected a JSON object.', field: 'body' };
  }
  const f = input as Record<string, unknown>;
  const rawId = f.fdcId;
  if (typeof rawId !== 'number' && typeof rawId !== 'string') {
    return { kind: 'invalid_input', message: 'Missing or invalid fdcId.', field: 'fdcId' };
  }
  const sourceFoodId = String(rawId);

  const description = f.description;
  if (typeof description !== 'string' || description.trim().length === 0) {
    return {
      kind: 'invalid_input',
      message: 'Missing or invalid description.',
      field: 'description',
    };
  }

  const baseAmountGrams = inferBaseAmountGrams(f);
  const foodNutrients = f.foodNutrients;
  const rawNutrients = Array.isArray(foodNutrients)
    ? deepCloneJson(foodNutrients)
    : [];

  const value: NormalizedReferenceFood = {
    source: REFERENCE_FOOD_SOURCE_USDA_FDC,
    sourceFoodId,
    displayName: description.trim(),
    brand: pickBrand(f),
    foodClass: pickFoodClass(f),
    baseAmountGrams,
    nutrients: extractNutrients(foodNutrients),
    servings: extractServings(f.foodPortions, baseAmountGrams),
    rawNutrients,
    rawPayload: deepCloneJson(f),
  };

  return { kind: 'ok', value };
}
