import { PREDEFINED_SERVING_UNIT_KEY_SET } from './predefined-serving-units.js';
import { PANTRY_ICON_KEYS } from './pantry-icon-keys.js';

/** International avoirdupois ounce to grams (exact definition used at storage boundary). */
export const GRAMS_PER_OUNCE = 28.349_523_125;

const ICON_KEY_SET = new Set<string>(PANTRY_ICON_KEYS);

const NUTRIENT_KEYS = ['calories', 'protein', 'fat', 'carbohydrates'] as const;

export type FoodNutrientsWire = Record<(typeof NUTRIENT_KEYS)[number], number>;

/** One measured option: either a predefined unit label or a custom label; mass is grams for one logical serving. */
export type FoodServingOptionStored =
  | { kind: 'unit'; unit: string; grams: number }
  | { kind: 'custom'; label: string; grams: number };

export type FoodItemMetadataWire = {
  kind: 'food';
  baseAmountGrams: number;
  nutrients: FoodNutrientsWire;
  brand?: string;
  servingOptions?: FoodServingOptionStored[];
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

const MAX_SERVING_OPTIONS = 32;

export function scaleNutrientsToGrams(
  nutrients: FoodNutrientsWire,
  baseAmountGrams: number,
  targetGrams: number,
): FoodNutrientsWire | null {
  if (!(baseAmountGrams > 0) || !(targetGrams > 0)) {
    return null;
  }
  const factor = targetGrams / baseAmountGrams;
  if (!Number.isFinite(factor)) {
    return null;
  }
  return {
    calories: nutrients.calories * factor,
    protein: nutrients.protein * factor,
    fat: nutrients.fat * factor,
    carbohydrates: nutrients.carbohydrates * factor,
  };
}

function parseServingGrams(raw: unknown, field: string): number | { field: string; message: string } {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { field, message: 'Must be a finite number.' };
  }
  if (raw <= 0) {
    return { field, message: 'Must be greater than zero.' };
  }
  return roundBaseGrams(raw);
}

/**
 * Validates optional `servingOptions` wire; each mass must convert to the food base mass for nutrient scaling.
 */
export function parseServingOptions(
  raw: unknown,
  baseAmountGrams: number,
): FoodServingOptionStored[] | { field: string; message: string } {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    return { field: 'servingOptions', message: 'Must be an array when provided.' };
  }
  if (raw.length > MAX_SERVING_OPTIONS) {
    return { field: 'servingOptions', message: `Must have at most ${MAX_SERVING_OPTIONS} entries.` };
  }

  const out: FoodServingOptionStored[] = [];
  const seenUnits = new Set<string>();
  const seenCustomLower = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const fieldPrefix = `servingOptions[${i}]`;
    const entry = raw[i];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return { field: fieldPrefix, message: 'Must be an object.' };
    }
    const o = entry as Record<string, unknown>;
    const kind = o['kind'];
    if (kind === 'unit') {
      const unitRaw = o['unit'];
      if (typeof unitRaw !== 'string' || !PREDEFINED_SERVING_UNIT_KEY_SET.has(unitRaw)) {
        return { field: `${fieldPrefix}.unit`, message: 'Is not a supported serving unit.' };
      }
      if (seenUnits.has(unitRaw)) {
        return { field: `${fieldPrefix}.unit`, message: 'Duplicate serving unit entries are not allowed.' };
      }
      const gramsField = `${fieldPrefix}.grams`;
      const gRes = parseServingGrams(o['grams'], gramsField);
      if (typeof gRes !== 'number') {
        return gRes;
      }
      const scaled = scaleNutrientsToGrams(
        { calories: 1, protein: 1, fat: 1, carbohydrates: 1 },
        baseAmountGrams,
        gRes,
      );
      if (scaled === null) {
        return {
          field: gramsField,
          message: 'Cannot be converted relative to this food base amount.',
        };
      }
      seenUnits.add(unitRaw);
      out.push({ kind: 'unit', unit: unitRaw, grams: gRes });
      continue;
    }
    if (kind === 'custom') {
      if (typeof o['label'] !== 'string') {
        return { field: `${fieldPrefix}.label`, message: 'Must be a string.' };
      }
      const t = o['label'].trim();
      if (t.length === 0) {
        return { field: `${fieldPrefix}.label`, message: 'Cannot be empty.' };
      }
      if (t.length > 100) {
        return { field: `${fieldPrefix}.label`, message: 'Must be at most 100 characters.' };
      }
      const labelRes = t;
      const lk = labelRes.toLowerCase();
      if (seenCustomLower.has(lk)) {
        return { field: `${fieldPrefix}.label`, message: 'Duplicate custom serving labels are not allowed.' };
      }
      const gramsField = `${fieldPrefix}.grams`;
      const gRes = parseServingGrams(o['grams'], gramsField);
      if (typeof gRes !== 'number') {
        return gRes;
      }
      const scaled = scaleNutrientsToGrams(
        { calories: 1, protein: 1, fat: 1, carbohydrates: 1 },
        baseAmountGrams,
        gRes,
      );
      if (scaled === null) {
        return {
          field: gramsField,
          message: 'Cannot be converted relative to this food base amount.',
        };
      }
      seenCustomLower.add(lk);
      out.push({ kind: 'custom', label: labelRes, grams: gRes });
      continue;
    }
    return { field: `${fieldPrefix}.kind`, message: `Must be "unit" or "custom".` };
  }

  return out;
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

  const servingsRes = parseServingOptions(body['servingOptions'], baseRes.grams);
  if ('field' in servingsRes) {
    return { kind: 'invalid_input', field: servingsRes.field, message: servingsRes.message };
  }

  const metadata: FoodItemMetadataWire = {
    kind: 'food',
    baseAmountGrams: baseRes.grams,
    nutrients: nutrientsRes,
  };
  if (brandRes !== undefined) {
    metadata.brand = brandRes;
  }
  if (servingsRes.length > 0) {
    metadata.servingOptions = servingsRes;
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
