import { describe, expect, it } from 'vitest';

import type { ReferenceFoodRow } from '@healthy/db/schema';

import {
  mapOrderedIdsToSearchCards,
  referenceFoodRowToDetailWire,
  referenceFoodRowToSearchCard,
} from '../src/reference-food/reference-food-public-wire.js';

function mockRow(partial: Partial<ReferenceFoodRow> & Pick<ReferenceFoodRow, 'id'>): ReferenceFoodRow {
  const now = new Date('2026-04-30T12:00:00.000Z');
  return {
    source: 'usda_fdc',
    sourceFoodId: '1',
    displayName: 'Test',
    brand: null,
    foodClass: null,
    baseAmountGrams: 100,
    calories: 50,
    proteinGrams: 1,
    fatGrams: 2,
    carbohydratesGrams: 3,
    servings: [],
    rawNutrients: [],
    rawPayload: {},
    iconKey: 'food_bowl',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe('referenceFoodRowToSearchCard', () => {
  it('includes serving preview from the first serving', () => {
    const row = mockRow({
      id: '550e8400-e29b-41d4-a716-446655440001',
      servings: [{ label: '1 cup', gramWeight: 240 }],
    });
    expect(referenceFoodRowToSearchCard(row).servingPreview).toEqual({
      label: '1 cup',
      gramWeight: 240,
    });
  });

  it('uses null servingPreview when there are no servings', () => {
    const row = mockRow({ id: '550e8400-e29b-41d4-a716-446655440002' });
    expect(referenceFoodRowToSearchCard(row).servingPreview).toBeNull();
  });
});

describe('mapOrderedIdsToSearchCards', () => {
  it('preserves order, skips inactive and unknown ids', () => {
    const a = mockRow({
      id: '550e8400-e29b-41d4-a716-446655440010',
      displayName: 'Second',
      isActive: true,
    });
    const b = mockRow({
      id: '550e8400-e29b-41d4-a716-446655440011',
      displayName: 'Inactive',
      isActive: false,
    });
    const c = mockRow({
      id: '550e8400-e29b-41d4-a716-446655440012',
      displayName: 'First',
      isActive: true,
    });
    const map = new Map<string, ReferenceFoodRow>([
      [a.id, a],
      [b.id, b],
      [c.id, c],
    ]);
    const ordered = ['550e8400-e29b-41d4-a716-446655440099', c.id, b.id, a.id];
    const cards = mapOrderedIdsToSearchCards(ordered, map);
    expect(cards.map((x) => x.displayName)).toEqual(['First', 'Second']);
  });
});

describe('referenceFoodRowToDetailWire', () => {
  it('maps servings and snapshot fields', () => {
    const row = mockRow({
      id: '550e8400-e29b-41d4-a716-446655440020',
      rawNutrients: [{ n: 1 }],
      rawPayload: { x: true },
      servings: [{ label: 'base', gramWeight: null }],
    });
    const wire = referenceFoodRowToDetailWire(row);
    expect(wire.servings).toEqual([{ label: 'base', gramWeight: null }]);
    expect(wire.rawNutrients).toEqual([{ n: 1 }]);
    expect(wire.rawPayload).toEqual({ x: true });
  });
});
