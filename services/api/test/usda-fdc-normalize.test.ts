import { describe, expect, it } from 'vitest';

import { REFERENCE_FOOD_SOURCE_USDA_FDC } from '../src/reference-food/normalized-reference-food.js';
import { normalizeUsdaFdcFood } from '../src/reference-food/usda-fdc/index.js';

function macroNutrient(id: number, number: string, name: string, unitName: string, amount: number) {
  return {
    nutrient: { id, number, name, rank: 1, unitName },
    amount,
  };
}

describe('normalizeUsdaFdcFood', () => {
  it('normalizes a branded record with identity, name, brand, food class, macros, servings, and raw payload', () => {
    const fixture = {
      fdcId: 22_222,
      dataType: 'Branded',
      description: '  Organic Oats  ',
      brandName: 'Morning Co',
      brandedFoodCategory: { description: 'Breakfast Cereals' },
      foodNutrients: [
        macroNutrient(1008, '208', 'Energy', 'KCAL', 380),
        macroNutrient(1003, '203', 'Protein', 'G', 13),
        macroNutrient(1004, '204', 'Total lipid (fat)', 'G', 6),
        macroNutrient(1005, '205', 'Carbohydrate, by difference', 'G', 62),
        macroNutrient(1087, '301', 'Calcium, Ca', 'MG', 50),
      ],
      foodPortions: [
        {
          portionDescription: '1 cup',
          modifier: 'cooked',
          gramWeight: 240,
        },
      ],
    };

    const r = normalizeUsdaFdcFood(fixture);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }

    expect(r.value.source).toBe(REFERENCE_FOOD_SOURCE_USDA_FDC);
    expect(r.value.sourceFoodId).toBe('22222');
    expect(r.value.displayName).toBe('Organic Oats');
    expect(r.value.brand).toBe('Morning Co');
    expect(r.value.foodClass).toBe('Breakfast Cereals');
    expect(r.value.baseAmountGrams).toBe(100);
    expect(r.value.nutrients).toEqual({
      caloriesKcal: 380,
      proteinGrams: 13,
      fatGrams: 6,
      carbohydratesGrams: 62,
    });
    expect(r.value.servings).toEqual([
      { label: '1 cup cooked', gramWeight: 240 },
    ]);
    expect(r.value.rawPayload).toEqual(fixture);
    expect(r.value.rawNutrients).toEqual(fixture.foodNutrients);
    expect(r.value.rawPayload.foodNutrients).toEqual(fixture.foodNutrients);
  });

  it('normalizes a generic (foundation) record without a brand', () => {
    const fixture = {
      fdcId: 33_333,
      dataType: 'Foundation',
      description: 'Rolled oats',
      foodCategory: { description: 'Grains and Pasta' },
      foodNutrients: [
        macroNutrient(1008, '208', 'Energy', 'KCAL', 379),
        macroNutrient(1003, '203', 'Protein', 'G', 13.2),
        macroNutrient(1004, '204', 'Total lipid (fat)', 'G', 6.5),
        macroNutrient(1005, '205', 'Carbohydrate, by difference', 'G', 67.7),
      ],
      foodPortions: [],
    };

    const r = normalizeUsdaFdcFood(fixture);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.value.brand).toBeNull();
    expect(r.value.foodClass).toBe('Grains and Pasta');
    expect(r.value.nutrients.caloriesKcal).toBe(379);
    expect(r.value.servings).toContainEqual({ label: '100 g', gramWeight: 100 });
  });

  it('treats missing brand fields as null', () => {
    const fixture = {
      fdcId: 44_444,
      description: 'Plain grain',
      brandName: '   ',
      brandOwner: '',
      foodNutrients: [],
    };
    const r = normalizeUsdaFdcFood(fixture);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.value.brand).toBeNull();
  });

  it('uses nulls for missing or unsupported nutrients while preserving raw nutrient rows', () => {
    const foodNutrients = [
      macroNutrient(1087, '301', 'Calcium, Ca', 'MG', 99),
      { nutrient: { id: 9999, number: '999', name: 'Unknown', unitName: 'G' }, amount: 3 },
    ];
    const fixture = {
      fdcId: 55_555,
      description: 'Trace mineral oddity',
      foodNutrients,
    };
    const r = normalizeUsdaFdcFood(fixture);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.value.nutrients).toEqual({
      caloriesKcal: null,
      proteinGrams: null,
      fatGrams: null,
      carbohydratesGrams: null,
    });
    expect(r.value.rawNutrients).toEqual(foodNutrients);
  });

  it('maps energy when reported in kilojoules', () => {
    const fixture = {
      fdcId: 66_666,
      description: 'KJ energy row',
      foodNutrients: [macroNutrient(1008, '208', 'Energy', 'KJ', 418.4)],
    };
    const r = normalizeUsdaFdcFood(fixture);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.value.nutrients.caloriesKcal).toBeCloseTo(100, 5);
  });

  it('exposes gram-weighted portions and adds a grams fallback when portions lack weights', () => {
    const fixture = {
      fdcId: 77_777,
      description: 'Portion labels only',
      foodNutrients: [],
      foodPortions: [{ portionDescription: '1 slice', modifier: '', gramWeight: 0 }],
    };
    const r = normalizeUsdaFdcFood(fixture);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.value.servings).toEqual([
      { label: '1 slice', gramWeight: null },
      { label: '100 g', gramWeight: 100 },
    ]);
  });

  it('uses servingSize in grams as base amount when provided', () => {
    const fixture = {
      fdcId: 88_888,
      description: 'Labeled serving',
      servingSize: 35,
      servingSizeUnit: 'g',
      foodNutrients: [macroNutrient(1003, '203', 'Protein', 'G', 7)],
    };
    const r = normalizeUsdaFdcFood(fixture);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.value.baseAmountGrams).toBe(35);
    expect(r.value.servings.some((s) => s.gramWeight === 35)).toBe(true);
  });

  it('deep-clones raw payload so later mutation does not affect normalized result', () => {
    const fixture = {
      fdcId: 99_999,
      description: 'Mutate me',
      foodNutrients: [],
    };
    const r = normalizeUsdaFdcFood(fixture);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    (fixture as { extra?: string }).extra = 'x';
    expect(r.value.rawPayload.extra).toBeUndefined();
  });

  it('rejects non-objects', () => {
    expect(normalizeUsdaFdcFood(null)).toEqual({
      kind: 'invalid_input',
      message: 'Expected a JSON object.',
      field: 'body',
    });
  });

  it('accepts string fdcId', () => {
    const r = normalizeUsdaFdcFood({
      fdcId: '12345',
      description: 'Ok',
      foodNutrients: [],
    });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.value.sourceFoodId).toBe('12345');
  });
});
