import { describe, expect, it } from 'vitest';

import type { PantryItemRow } from '@healthy/db/schema';

import type { FoodItemMetadataWire } from '../src/pantry/create-food-payload.js';
import {
  gramsForIngredientServing,
  planCreateRecipe,
  topIngredientIconKeysByScaledCalories,
} from '../src/pantry/create-recipe-payload.js';

describe('topIngredientIconKeysByScaledCalories', () => {
  it('sorts icons by summed calories descending and caps at three', () => {
    const m = new Map<string, number>([
      ['food_milk', 100],
      ['food_apple', 400],
      ['food_carrot', 350],
      ['food_nut', 200],
    ]);
    expect(topIngredientIconKeysByScaledCalories(m)).toEqual([
      'food_apple',
      'food_carrot',
      'food_nut',
    ]);
  });

  it('breaks ties by alphabetical icon key order', () => {
    expect(
      topIngredientIconKeysByScaledCalories(
        new Map<string, number>([
          ['food_nut', 10],
          ['food_milk', 10],
        ]),
      ),
    ).toEqual(['food_milk', 'food_nut']);
  });
});

describe('planCreateRecipe', () => {
  function foodRow(
    id: string,
    meta: FoodItemMetadataWire,
    iconKey: string = 'food_apple',
  ): PantryItemRow {
    return {
      id,
      ownerUserId: '00000000-0000-0000-0000-000000000001',
      itemType: 'food',
      name: 'Test',
      iconKey,
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

  it('fills ingredient icon keys by scaled-calorie rank (two pantry foods)', () => {
    const fBowl = foodRow(
      '11111111-1111-4111-8111-111111111112',
      {
        kind: 'food',
        baseAmountGrams: 100,
        nutrients: {
          calories: 130,
          protein: 2.7,
          fat: 0.3,
          carbohydrates: 28,
        },
      },
      'food_bowl',
    );
    const fEgg = foodRow(
      '22222222-2222-4222-8222-222222222223',
      {
        kind: 'food',
        baseAmountGrams: 50,
        nutrients: { calories: 70, protein: 6, fat: 5, carbohydrates: 0.5 },
        servingOptions: [{ kind: 'unit', unit: 'slice', grams: 50 }],
      },
      'food_egg',
    );
    const map = new Map([
      [fBowl.id, fBowl],
      [fEgg.id, fEgg],
    ]);
    const out = planCreateRecipe(
      {
        name: 'Rice and egg',
        iconKey: 'recipe_pot',
        servings: 2,
        servingLabel: 'portion',
        ingredients: [
          { foodId: fBowl.id, quantity: 1, servingOption: { kind: 'base' } },
          { foodId: fEgg.id, quantity: 1, servingOption: { kind: 'unit', unit: 'slice' } },
        ],
      },
      map,
    );
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') {
      return;
    }
    expect(out.value.metadata.ingredientIconKeys).toEqual(['food_bowl', 'food_egg']);
  });

  it('merges calorie sums for ingredient lines sharing the same pantry icon key', () => {
    const appleSmall = foodRow(
      'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
      {
        kind: 'food',
        baseAmountGrams: 40,
        nutrients: { calories: 40, protein: 1, fat: 0, carbohydrates: 9 },
      },
      'food_apple',
    );
    const appleLarge = foodRow(
      'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
      {
        kind: 'food',
        baseAmountGrams: 80,
        nutrients: { calories: 96, protein: 1, fat: 0, carbohydrates: 22 },
      },
      'food_apple',
    );
    const carrot = foodRow(
      'dddddddd-dddd-4ddd-8ddd-dddddddddd03',
      {
        kind: 'food',
        baseAmountGrams: 55,
        nutrients: {
          calories: 22,
          protein: 0.6,
          fat: 0.1,
          carbohydrates: 5,
        },
      },
      'food_carrot',
    );
    const map = new Map([
      [appleSmall.id, appleSmall],
      [appleLarge.id, appleLarge],
      [carrot.id, carrot],
    ]);
    const out = planCreateRecipe(
      {
        name: 'Salad-ish',
        iconKey: 'recipe_pot',
        servings: 1,
        ingredients: [
          { foodId: appleSmall.id, quantity: 1, servingOption: { kind: 'base' } },
          { foodId: carrot.id, quantity: 1, servingOption: { kind: 'base' } },
          { foodId: appleLarge.id, quantity: 1, servingOption: { kind: 'base' } },
        ],
      },
      map,
    );
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') {
      return;
    }
    expect(out.value.metadata.ingredientIconKeys).toEqual([
      'food_apple',
      'food_carrot',
    ]);
  });

  it('keeps only the top three distinct ingredient icon keys', () => {
    const fApple = foodRow(
      'f0000001-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      { kind: 'food', baseAmountGrams: 100, nutrients: { calories: 100, protein: 0, fat: 0, carbohydrates: 25 } },
      'food_apple',
    );
    const fBanana = foodRow(
      'f0000002-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      { kind: 'food', baseAmountGrams: 100, nutrients: { calories: 350, protein: 0, fat: 0, carbohydrates: 90 } },
      'food_banana',
    );
    const fBowl = foodRow(
      'f0000003-cccc-4ccc-8ccc-cccccccccccc',
      { kind: 'food', baseAmountGrams: 40, nutrients: { calories: 150, protein: 0, fat: 0, carbohydrates: 30 } },
      'food_bowl',
    );
    const fEgg = foodRow(
      'f0000004-dddd-4ddd-8ddd-dddddddddddd',
      { kind: 'food', baseAmountGrams: 50, nutrients: { calories: 70, protein: 0, fat: 0, carbohydrates: 0 } },
      'food_egg',
    );
    const fMilk = foodRow(
      'f0000005-eeee-4eee-8eee-eeeeeeeeeeee',
      { kind: 'food', baseAmountGrams: 244, nutrients: { calories: 122, protein: 0, fat: 0, carbohydrates: 12 } },
      'food_milk',
    );
    const map = new Map([
      [fApple.id, fApple],
      [fBanana.id, fBanana],
      [fBowl.id, fBowl],
      [fEgg.id, fEgg],
      [fMilk.id, fMilk],
    ]);
    const out = planCreateRecipe(
      {
        name: 'Breakfast spread',
        iconKey: 'recipe_pot',
        servings: 1,
        ingredients: [
          { foodId: fEgg.id, quantity: 1, servingOption: { kind: 'base' } },
          { foodId: fMilk.id, quantity: 1, servingOption: { kind: 'base' } },
          { foodId: fApple.id, quantity: 1, servingOption: { kind: 'base' } },
          { foodId: fBanana.id, quantity: 1, servingOption: { kind: 'base' } },
          { foodId: fBowl.id, quantity: 1, servingOption: { kind: 'base' } },
        ],
      },
      map,
    );
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') {
      return;
    }
    expect(out.value.metadata.ingredientIconKeys).toEqual([
      'food_banana',
      'food_bowl',
      'food_milk',
    ]);
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
