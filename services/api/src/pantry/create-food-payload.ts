import { PANTRY_ICON_KEYS } from './pantry-icon-keys.js';

/** International avoirdupois ounce to grams (exact definition used at storage boundary). */
export const GRAMS_PER_OUNCE = 28.349_523_125;

const ICON_KEY_SET = new Set<string>(PANTRY_ICON_KEYS);

const NUTRIENT_KEYS = ['calories', 'protein', 'fat', 'carbohydrates'] as const;

export type FoodNutrientsWire = Record<(typeof NUTRIENT_KEYS)[number], number>;

export type FoodItemMetadataWire = {
  kind: 'food';
  baseAmountGrams: number;
  nutrients: FoodNutrientsWire;
  brand?: string;
};

export type CreateFoodParsed = {
  name: string;
  iconKey: string;
  metadata: FoodItemMetadataWire;
};

function roundBaseGrams(grams: number): number {
  return Math.round(grams * 1_000_000) / 1_000_000;
}

/** Grams stored for a 1 oz base amount after boundary normalization rounding. */
export const STORED_GRAMS_FOR_ONE_OUNCE = roundBaseGrams(GRAMS_PER_OUNCE);

function nonEmptyString(raw: unknown, field: string): string | { field: string; message: string } {
  if (typeof raw !== 'string') {
    return { field, message: 'Must be a string.' };
  }
  const t = raw.trim();
  if (t.length === 0) {
    return { field, message: 'Cannot be empty.' };
  }
  if (t.length > 500) {
    return { field, message: 'Must be at most 500 characters.' };
  }
  return t;
}

function optionalBrand(raw: unknown): string | undefined | { field: string; message: string } {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== 'string') {
    return { field: 'brand', message: 'Must be a string when provided.' };
  }
  const t = raw.trim();
  if (t.length === 0) {
    return undefined;
  }
  if (t.length > 200) {
    return { field: 'brand', message: 'Must be at most 200 characters.' };
  }
  return t;
}

function parseIconKey(raw: unknown): string | { field: string; message: string } {
  if (typeof raw !== 'string') {
    return { field: 'iconKey', message: 'Must be a string.' };
  }
  if (!ICON_KEY_SET.has(raw)) {
    return { field: 'iconKey', message: 'Is not a supported icon key.' };
  }
  return raw;
}

function parseBaseAmount(raw: unknown): { grams: number } | { field: string; message: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { field: 'baseAmount', message: 'Must be an object with value and unit.' };
  }
  const o = raw as Record<string, unknown>;
  const value = o['value'];
  const unit = o['unit'];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { field: 'baseAmount.value', message: 'Must be a finite number.' };
  }
  if (value <= 0) {
    return { field: 'baseAmount.value', message: 'Must be greater than zero.' };
  }
  if (unit !== 'g' && unit !== 'oz') {
    return { field: 'baseAmount.unit', message: 'Must be "g" or "oz".' };
  }
  const grams = unit === 'oz' ? value * GRAMS_PER_OUNCE : value;
  return { grams: roundBaseGrams(grams) };
}

function parseNutrients(
  raw: unknown,
): FoodNutrientsWire | { field: string; message: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { field: 'nutrients', message: 'Must be an object.' };
  }
  const o = raw as Record<string, unknown>;
  const out: Partial<FoodNutrientsWire> = {};
  for (const key of NUTRIENT_KEYS) {
    const v = o[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return { field: `nutrients.${key}`, message: 'Must be a finite number.' };
    }
    if (v < 0) {
      return { field: `nutrients.${key}`, message: 'Cannot be negative.' };
    }
    out[key] = v;
  }
  return out as FoodNutrientsWire;
}


export type ParseCreateFoodPayloadResult =
  | { kind: 'ok'; value: CreateFoodParsed }
  | { kind: 'invalid_input'; field: string; message: string };

/**
 * Validates a JSON-decoded request body for creating a Food Pantry item.
 * Routes own HTTP mapping; this function only returns closed outcomes.
 */
export function parseCreateFoodPayload(raw: unknown): ParseCreateFoodPayloadResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { kind: 'invalid_input', field: 'body', message: 'Expected a JSON object.' };
  }
  const body = raw as Record<string, unknown>;

  const nameRes = nonEmptyString(body['name'], 'name');
  if (typeof nameRes !== 'string') {
    return { kind: 'invalid_input', field: nameRes.field, message: nameRes.message };
  }

  const brandRes = optionalBrand(body['brand']);
  if (brandRes !== undefined && typeof brandRes !== 'string') {
    return { kind: 'invalid_input', field: brandRes.field, message: brandRes.message };
  }

  const iconRes = parseIconKey(body['iconKey']);
  if (typeof iconRes !== 'string') {
    return { kind: 'invalid_input', field: iconRes.field, message: iconRes.message };
  }

  const baseRes = parseBaseAmount(body['baseAmount']);
  if (!('grams' in baseRes)) {
    return { kind: 'invalid_input', field: baseRes.field, message: baseRes.message };
  }

  const nutrientsRes = parseNutrients(body['nutrients']);
  if ('field' in nutrientsRes) {
    return { kind: 'invalid_input', field: nutrientsRes.field, message: nutrientsRes.message };
  }

  const metadata: FoodItemMetadataWire = {
    kind: 'food',
    baseAmountGrams: baseRes.grams,
    nutrients: nutrientsRes,
  };
  if (brandRes !== undefined) {
    metadata.brand = brandRes;
  }

  return {
    kind: 'ok',
    value: {
      name: nameRes,
      iconKey: iconRes,
      metadata,
    },
  };
}
