import { describe, expect, it } from 'vitest';

import {
  referenceFoodRowToSearchDocument,
  referenceFoodSearchIndexMappingsProperties,
} from '../src/reference-food/search/reference-food-search-document.js';

describe('referenceFoodRowToSearchDocument', () => {
  it('maps core fields and normalizes null brand/foodClass', () => {
    const row = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      source: 'usda_fdc',
      sourceFoodId: '123',
      displayName: 'Test Yogurt',
      brand: null,
      foodClass: null,
      baseAmountGrams: 100,
      calories: 80,
      proteinGrams: 4,
      fatGrams: 2,
      carbohydratesGrams: 10,
      servings: [],
      rawNutrients: [],
      rawPayload: {},
      iconKey: 'food_bowl',
      isActive: true,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-02T12:30:00.000Z'),
    };
    const doc = referenceFoodRowToSearchDocument(row as never);
    expect(doc).toMatchObject({
      referenceFoodId: '550e8400-e29b-41d4-a716-446655440000',
      source: 'usda_fdc',
      sourceFoodId: '123',
      displayName: 'Test Yogurt',
      brand: '',
      foodClass: '',
      iconKey: 'food_bowl',
      baseAmountGrams: 100,
      calories: 80,
      proteinGrams: 4,
      fatGrams: 2,
      carbohydratesGrams: 10,
      updatedAt: '2025-01-02T12:30:00.000Z',
    });
  });
});

describe('referenceFoodSearchIndexMappingsProperties', () => {
  it('declares text fields for displayName and brand', () => {
    const props = referenceFoodSearchIndexMappingsProperties();
    expect((props.displayName as { type: string }).type).toBe('text');
    expect((props.brand as { type: string }).type).toBe('text');
    expect((props.referenceFoodId as { type: string }).type).toBe('keyword');
  });
});
