import { describe, expect, it } from 'vitest';

import { parseCreateFoodPayload, STORED_GRAMS_FOR_ONE_OUNCE } from '../src/pantry/create-food-payload.js';

const validNutrients = {
  calories: 100,
  protein: 10,
  fat: 2,
  carbohydrates: 12,
};

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Oats',
    iconKey: 'food_bowl',
    baseAmount: { value: 100, unit: 'g' as const },
    nutrients: validNutrients,
    ...overrides,
  };
}

describe('parseCreateFoodPayload', () => {
  it('accepts a minimal valid food payload', () => {
    const r = parseCreateFoodPayload(validBody());
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.value.name).toBe('Test Oats');
    expect(r.value.iconKey).toBe('food_bowl');
    expect(r.value.metadata.kind).toBe('food');
    expect(r.value.metadata.baseAmountGrams).toBe(100);
    expect(r.value.metadata.brand).toBeUndefined();
    expect(r.value.metadata.nutrients).toEqual(validNutrients);
  });

  it('trims name and records optional brand when provided', () => {
    const r = parseCreateFoodPayload(validBody({ name: '  Trimmed  ', brand: '  Acme  ' }));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.value.name).toBe('Trimmed');
    expect(r.value.metadata.brand).toBe('Acme');
  });

  it('drops blank brand', () => {
    const r = parseCreateFoodPayload(validBody({ brand: '   ' }));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.value.metadata.brand).toBeUndefined();
  });

  it('converts ounces to stored grams', () => {
    const r = parseCreateFoodPayload(validBody({ baseAmount: { value: 1, unit: 'oz' } }));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') {
      return;
    }
    expect(r.value.metadata.baseAmountGrams).toBe(STORED_GRAMS_FOR_ONE_OUNCE);
  });

  it('rejects non-object body', () => {
    const r = parseCreateFoodPayload(null);
    expect(r).toEqual({
      kind: 'invalid_input',
      field: 'body',
      message: 'Expected a JSON object.',
    });
  });

  it('rejects empty name', () => {
    const r = parseCreateFoodPayload(validBody({ name: '  ' }));
    expect(r.kind).toBe('invalid_input');
    if (r.kind === 'invalid_input') {
      expect(r.field).toBe('name');
    }
  });

  it('rejects unsupported iconKey', () => {
    const r = parseCreateFoodPayload(validBody({ iconKey: 'not_a_key' }));
    expect(r.kind).toBe('invalid_input');
    if (r.kind === 'invalid_input') {
      expect(r.field).toBe('iconKey');
    }
  });

  it('rejects non-positive base amount', () => {
    const r = parseCreateFoodPayload(validBody({ baseAmount: { value: 0, unit: 'g' } }));
    expect(r.kind).toBe('invalid_input');
    if (r.kind === 'invalid_input') {
      expect(r.field).toBe('baseAmount.value');
    }
  });

  it('rejects negative nutrients', () => {
    const r = parseCreateFoodPayload(
      validBody({
        nutrients: { ...validNutrients, protein: -1 },
      }),
    );
    expect(r.kind).toBe('invalid_input');
    if (r.kind === 'invalid_input') {
      expect(r.field).toBe('nutrients.protein');
    }
  });
});
