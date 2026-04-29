import { describe, expect, it } from 'vitest';

import type { PantryItemRow } from '@healthy/db/schema';

import type { FoodItemMetadataWire } from '../src/pantry/create-food-payload.js';
import { gramsForIngredientServing, planCreateRecipe } from '../src/pantry/create-recipe-payload.js';

describe('planCreateRecipe', () => {
  function foodRow(id: string, meta: FoodItemMetadataWire): PantryItemRow {
    return {
      id,
      ownerUserId: '00000000-0000-0000-0000-000000000001',
      itemType: 'food',
      name: 'Test',
      iconKey: 'food_apple',
      metadata: meta as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function recipeRow(
    id: string,
    totals: { calories: number; protein: number; fat: number; carbohydrates: number },
    servings: number,
  ): PantryItemRow {
    const per = {
      calories: totals.calories / servings,
      protein: totals.protein / servings,
      fat: totals.fat / servings,
      carbohydrates: totals.carbohydrates / servings,
    };
    return {
      id,
      ownerUserId: '00000000-0000-0000-0000-000000000001',
      itemType: 'recipe',
      name: 'Inner',
      iconKey: 'recipe_pot',
      metadata: {
        kind: 'recipe',
        servings,
        servingLabel: 'portion',
        nutrients: totals,
        nutrientsPerServing: per,
      } as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it('computes totals and per-serving nutrients from base-only foods', () => {
    const f1 = foodRow('11111111-1111-4111-8111-111111111111', {
      kind: 'food',
      baseAmountGrams: 100,
      nutrients: { calories: 200, protein: 10, fat: 5, carbohydrates: 20 },
    });
    const map = new Map([[f1.id, f1]]);
    const out = planCreateRecipe(
      {
        name: 'Bowl',
        iconKey: 'food_bowl',
        servings: 2,
        ingredients: [
          {
            foodId: f1.id,
            quantity: 1.5,
            servingOption: { kind: 'base' },
          },
        ],
      },
      map,
    );
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') {
      return;
    }
    expect(out.value.metadata.nutrients.calories).toBe(300);
    expect(out.value.metadata.nutrientsPerServing.calories).toBe(150);
    expect(out.value.ingredients).toHaveLength(1);
    expect(out.value.ingredients[0]?.servingKind).toBe('base');
    expect(out.value.ingredients[0]?.ingredientKind).toBe('food');
  });

  it('uses a matching predefined serving option when the food declares servings', () => {
    const f1 = foodRow('22222222-2222-4222-8222-222222222222', {
      kind: 'food',
      baseAmountGrams: 100,
      nutrients: { calories: 100, protein: 4, fat: 1, carbohydrates: 10 },
      servingOptions: [{ kind: 'unit', unit: 'slice', grams: 30 }],
    });
    const map = new Map([[f1.id, f1]]);
    const out = planCreateRecipe(
      {
        name: 'Toast',
        iconKey: 'food_apple',
        servings: 1,
        ingredients: [
          {
            foodId: f1.id,
            quantity: 2,
            servingOption: { kind: 'unit', unit: 'slice' },
          },
        ],
      },
      map,
    );
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') {
      return;
    }
    expect(out.value.metadata.nutrients.calories).toBe(60);
  });

  it('rejects base serving when the food has serving options', () => {
    const f1 = foodRow('33333333-3333-4333-8333-333333333333', {
      kind: 'food',
      baseAmountGrams: 100,
      nutrients: { calories: 100, protein: 4, fat: 1, carbohydrates: 10 },
      servingOptions: [{ kind: 'unit', unit: 'slice', grams: 30 }],
    });
    const map = new Map([[f1.id, f1]]);
    const out = planCreateRecipe(
      {
        name: 'X',
        iconKey: 'food_apple',
        servings: 1,
        ingredients: [
          {
            foodId: f1.id,
            quantity: 1,
            servingOption: { kind: 'base' },
          },
        ],
      },
      map,
    );
    expect(out.kind).toBe('invalid_input');
  });

  it('rejects unknown owned food id', () => {
    const out = planCreateRecipe(
      {
        name: 'X',
        iconKey: 'food_apple',
        servings: 1,
        ingredients: [
          {
            foodId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            quantity: 1,
            servingOption: { kind: 'base' },
          },
        ],
      },
      new Map(),
    );
    expect(out.kind).toBe('invalid_input');
  });

  it('sums nutrients from a nested recipe using full-yield base servings', () => {
    const inner = recipeRow('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
      calories: 400,
      protein: 20,
      fat: 10,
      carbohydrates: 40,
    }, 4);
    const map = new Map([[inner.id, inner]]);
    const out = planCreateRecipe(
      {
        name: 'Uses inner',
        iconKey: 'recipe_pot',
        servings: 1,
        ingredients: [
          {
            recipeId: inner.id,
            quantity: 1,
            servingOption: { kind: 'base' },
          },
        ],
      },
      map,
    );
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') {
      return;
    }
    expect(out.value.ingredients[0]?.ingredientKind).toBe('recipe');
    expect(out.value.metadata.nutrients.calories).toBe(400);
  });

  it('sums nutrients from nested recipe per labeled serving', () => {
    const inner = recipeRow('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', {
      calories: 400,
      protein: 20,
      fat: 10,
      carbohydrates: 40,
    }, 4);
    const map = new Map([[inner.id, inner]]);
    const out = planCreateRecipe(
      {
        name: 'Uses inner',
        iconKey: 'recipe_pot',
        servings: 1,
        ingredients: [
          {
            recipeId: inner.id,
            quantity: 2,
            servingOption: { kind: 'unit', unit: 'serving' },
          },
        ],
      },
      map,
    );
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') {
      return;
    }
    expect(out.value.metadata.nutrients.calories).toBe(200);
  });
});

describe('gramsForIngredientServing', () => {
  const foodBaseOnly: FoodItemMetadataWire = {
    kind: 'food',
    baseAmountGrams: 50,
    nutrients: { calories: 50, protein: 1, fat: 0, carbohydrates: 5 },
  };

  it('returns base amount grams times quantity for base kind', () => {
    const g = gramsForIngredientServing(foodBaseOnly, 2, { kind: 'base' }, 'ingredients[0]');
    expect(g).toBe(100);
  });
});
