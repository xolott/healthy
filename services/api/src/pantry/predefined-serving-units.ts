/**
 * Predefined pantry serving-unit keys for Foods (wire + validation).
 * Order is stable for `/pantry/reference` responses.
 */
export const PREDEFINED_SERVING_UNIT_ENTRIES = [
  { key: 'slice', displayName: 'Slice' },
  { key: 'cup', displayName: 'Cup' },
  { key: 'unit', displayName: 'Unit' },
  { key: 'scoop', displayName: 'Scoop' },
  { key: 'tbsp', displayName: 'Tbsp' },
  { key: 'tsp', displayName: 'Tsp' },
] as const;

export type PredefinedServingUnitKey = (typeof PREDEFINED_SERVING_UNIT_ENTRIES)[number]['key'];

const KEYS = PREDEFINED_SERVING_UNIT_ENTRIES.map((e) => e.key);

export const PREDEFINED_SERVING_UNIT_KEY_SET = new Set<string>(KEYS);
