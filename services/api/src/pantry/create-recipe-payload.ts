import type { PantryItemRow } from '@healthy/db/schema';

import {
  type FoodItemMetadataWire,
  type FoodNutrientsWire,
  scaleNutrientsToGrams,
} from './create-food-payload.js';
import { PANTRY_ICON_KEYS } from './pantry-icon-keys.js';

const ICON_KEY_SET = new Set<string>(PANTRY_ICON_KEYS);

const MAX_INGREDIENTS = 64;

export type RecipeIngredientServingWire =
  | { kind: 'base' }
  | { kind: 'unit'; unit: string }
  | { kind: 'custom'; label: string };

export type RecipeItemMetadataWire = {
  kind: 'recipe';
  servings: number;
  servingLabel: string;
  nutrients: FoodNutrientsWire;
  nutrientsPerServing: FoodNutrientsWire;
};

export type CreateRecipeIngredientForRow = {
  ingredientFoodPantryItemId: string;
  sortOrder: number;
  servingKind: 'base' | 'unit' | 'custom';
  servingUnitKey: string | null;
  servingCustomLabel: string | null;
  quantity: number;
};

export type CreateRecipePlan = {
  name: string;
  iconKey: string;
  metadata: RecipeItemMetadataWire;
  ingredients: CreateRecipeIngredientForRow[];
};

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

function parseIconKey(raw: unknown): string | { field: string; message: string } {
  if (typeof raw !== 'string') {
    return { field: 'iconKey', message: 'Must be a string.' };
  }
  if (!ICON_KEY_SET.has(raw)) {
    return { field: 'iconKey', message: 'Is not a supported icon key.' };
  }
  return raw;
}

function parseServings(raw: unknown): number | { field: string; message: string } {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { field: 'servings', message: 'Must be a finite number.' };
  }
  if (raw <= 0) {
    return { field: 'servings', message: 'Must be greater than zero.' };
  }
  return raw;
}

function parseServingLabel(raw: unknown): string | { field: string; message: string } {
  if (raw === undefined || raw === null) {
    return 'serving';
  }
  if (typeof raw !== 'string') {
    return { field: 'servingLabel', message: 'Must be a string when provided.' };
  }
  const t = raw.trim();
  if (t.length === 0) {
    return 'serving';
  }
  if (t.length > 100) {
    return { field: 'servingLabel', message: 'Must be at most 100 characters.' };
  }
  return t;
}

function parseUuid(raw: unknown, field: string): string | { field: string; message: string } {
  if (typeof raw !== 'string') {
    return { field, message: 'Must be a string.' };
  }
  const t = raw.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)
  ) {
    return { field, message: 'Must be a valid UUID.' };
  }
  return t;
}

function parseQuantity(raw: unknown, field: string): number | { field: string; message: string } {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { field, message: 'Must be a finite number.' };
  }
  if (raw <= 0) {
    return { field, message: 'Must be greater than zero.' };
  }
  return raw;
}

function parseIngredientServingOption(
  raw: unknown,
  fieldPrefix: string,
): RecipeIngredientServingWire | { field: string; message: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { field: `${fieldPrefix}.servingOption`, message: 'Must be an object.' };
  }
  const o = raw as Record<string, unknown>;
  const kind = o['kind'];
  if (kind === 'base') {
    return { kind: 'base' };
  }
  if (kind === 'unit') {
    const unit = o['unit'];
    if (typeof unit !== 'string' || unit.trim() === '') {
      return { field: `${fieldPrefix}.servingOption.unit`, message: 'Must be a non-empty string.' };
    }
    return { kind: 'unit', unit: unit.trim() };
  }
  if (kind === 'custom') {
    const label = o['label'];
    if (typeof label !== 'string' || label.trim() === '') {
      return { field: `${fieldPrefix}.servingOption.label`, message: 'Must be a non-empty string.' };
    }
    return { kind: 'custom', label: label.trim() };
  }
  return { field: `${fieldPrefix}.servingOption.kind`, message: 'Must be base, unit, or custom.' };
}

function asFoodMetadata(row: PantryItemRow): FoodItemMetadataWire | null {
  if (row.itemType !== 'food') {
    return null;
  }
  const meta = row.metadata;
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
    return null;
  }
  const m = meta as Record<string, unknown>;
  if (m['kind'] !== 'food') {
    return null;
  }
  const base = m['baseAmountGrams'];
  const nutrients = m['nutrients'];
  if (typeof base !== 'number' || nutrients === null || typeof nutrients !== 'object') {
    return null;
  }
  const n = nutrients as Record<string, unknown>;
  for (const k of ['calories', 'protein', 'fat', 'carbohydrates'] as const) {
    if (typeof n[k] !== 'number') {
      return null;
    }
  }
  const out: FoodItemMetadataWire = {
    kind: 'food',
    baseAmountGrams: base,
    nutrients: {
      calories: n['calories'] as number,
      protein: n['protein'] as number,
      fat: n['fat'] as number,
      carbohydrates: n['carbohydrates'] as number,
    },
  };
  if (typeof m['brand'] === 'string' && m['brand'].trim() !== '') {
    out.brand = m['brand'] as string;
  }
  const so = m['servingOptions'];
  if (Array.isArray(so) && so.length > 0) {
    const parsed: NonNullable<FoodItemMetadataWire['servingOptions']> = [];
    for (const e of so) {
      if (e === null || typeof e !== 'object' || Array.isArray(e)) {
        continue;
      }
      const x = e as Record<string, unknown>;
      if (x['kind'] === 'unit' && typeof x['unit'] === 'string' && typeof x['grams'] === 'number') {
        parsed.push({ kind: 'unit', unit: x['unit'], grams: x['grams'] });
      } else if (
        x['kind'] === 'custom' &&
        typeof x['label'] === 'string' &&
        typeof x['grams'] === 'number'
      ) {
        parsed.push({ kind: 'custom', label: x['label'], grams: x['grams'] });
      }
    }
    if (parsed.length > 0) {
      out.servingOptions = parsed;
    }
  }
  return out;
}

/** Grams of food mass contributed by quantity × chosen serving. */
export function gramsForIngredientServing(
  food: FoodItemMetadataWire,
  quantity: number,
  serving: RecipeIngredientServingWire,
  fieldPrefix: string,
): number | { field: string; message: string } {
  const options = food.servingOptions;
  const hasOptions = options !== undefined && options.length > 0;

  if (serving.kind === 'base') {
    if (hasOptions) {
      return {
        field: `${fieldPrefix}.servingOption`,
        message: 'Choose one of this food’s serving options.',
      };
    }
    return food.baseAmountGrams * quantity;
  }

  if (!hasOptions) {
    return {
      field: `${fieldPrefix}.servingOption`,
      message: 'This food has no serving options; use base amount.',
    };
  }

  if (serving.kind === 'unit') {
    const opt = options.find((o) => o.kind === 'unit' && o.unit === serving.unit);
    if (opt === undefined) {
      return { field: `${fieldPrefix}.servingOption`, message: 'Serving unit does not match this food.' };
    }
    return opt.grams * quantity;
  }

  const opt = options.find((o) => o.kind === 'custom' && o.label === serving.label);
  if (opt === undefined) {
    return {
      field: `${fieldPrefix}.servingOption`,
      message: 'Custom serving does not match this food.',
    };
  }
  return opt.grams * quantity;
}

function servingToRowFields(
  serving: RecipeIngredientServingWire,
): Pick<CreateRecipeIngredientForRow, 'servingKind' | 'servingUnitKey' | 'servingCustomLabel'> {
  if (serving.kind === 'base') {
    return { servingKind: 'base', servingUnitKey: null, servingCustomLabel: null };
  }
  if (serving.kind === 'unit') {
    return { servingKind: 'unit', servingUnitKey: serving.unit, servingCustomLabel: null };
  }
  return { servingKind: 'custom', servingUnitKey: null, servingCustomLabel: serving.label };
}

function sumNutrients(a: FoodNutrientsWire, b: FoodNutrientsWire): FoodNutrientsWire {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbohydrates: a.carbohydrates + b.carbohydrates,
  };
}

const zeroNutrients: FoodNutrientsWire = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbohydrates: 0,
};

function scaleNutrientsScalar(n: FoodNutrientsWire, factor: number): FoodNutrientsWire {
  return {
    calories: n.calories * factor,
    protein: n.protein * factor,
    fat: n.fat * factor,
    carbohydrates: n.carbohydrates * factor,
  };
}

export type ParseCreateRecipePayloadResult =
  | { kind: 'ok'; value: CreateRecipePlan }
  | { kind: 'invalid_input'; field: string; message: string };

export function planCreateRecipe(
  rawBody: unknown,
  foodRowsById: Map<string, PantryItemRow>,
): ParseCreateRecipePayloadResult {
  if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return { kind: 'invalid_input', field: 'body', message: 'Expected a JSON object.' };
  }
  const body = rawBody as Record<string, unknown>;

  const nameRes = nonEmptyString(body['name'], 'name');
  if (typeof nameRes !== 'string') {
    return { kind: 'invalid_input', field: nameRes.field, message: nameRes.message };
  }

  const iconRes = parseIconKey(body['iconKey']);
  if (typeof iconRes !== 'string') {
    return { kind: 'invalid_input', field: iconRes.field, message: iconRes.message };
  }

  const servingsRes = parseServings(body['servings']);
  if (typeof servingsRes !== 'number') {
    return { kind: 'invalid_input', field: servingsRes.field, message: servingsRes.message };
  }
  const servings = servingsRes;

  const labelRes = parseServingLabel(body['servingLabel']);
  if (typeof labelRes !== 'string') {
    return { kind: 'invalid_input', field: labelRes.field, message: labelRes.message };
  }

  const ingRaw = body['ingredients'];
  if (!Array.isArray(ingRaw)) {
    return { kind: 'invalid_input', field: 'ingredients', message: 'Must be an array.' };
  }
  if (ingRaw.length === 0) {
    return { kind: 'invalid_input', field: 'ingredients', message: 'At least one ingredient is required.' };
  }
  if (ingRaw.length > MAX_INGREDIENTS) {
    return {
      kind: 'invalid_input',
      field: 'ingredients',
      message: `Must have at most ${MAX_INGREDIENTS} ingredients.`,
    };
  }

  type ParsedIng = { foodId: string; quantity: number; serving: RecipeIngredientServingWire };
  const parsedLines: ParsedIng[] = [];
  const uniqueFoodIds = new Set<string>();

  for (let i = 0; i < ingRaw.length; i++) {
    const entry = ingRaw[i];
    const fp = `ingredients[${i}]`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return { kind: 'invalid_input', field: fp, message: 'Must be an object.' };
    }
    const o = entry as Record<string, unknown>;
    const foodIdRes = parseUuid(o['foodId'], `${fp}.foodId`);
    if (typeof foodIdRes !== 'string') {
      return { kind: 'invalid_input', field: `${fp}.foodId`, message: foodIdRes.message };
    }
    const qRes = parseQuantity(o['quantity'], `${fp}.quantity`);
    if (typeof qRes !== 'number') {
      return { kind: 'invalid_input', field: qRes.field, message: qRes.message };
    }
    const servingRes = parseIngredientServingOption(o['servingOption'], fp);
    if ('field' in servingRes) {
      return { kind: 'invalid_input', field: servingRes.field, message: servingRes.message };
    }
    uniqueFoodIds.add(foodIdRes);
    parsedLines.push({ foodId: foodIdRes, quantity: qRes, serving: servingRes });
  }

  for (const id of uniqueFoodIds) {
    if (!foodRowsById.has(id)) {
      return {
        kind: 'invalid_input',
        field: 'ingredients',
        message: 'Each ingredient must reference an existing food you own.',
      };
    }
  }

  let totals = zeroNutrients;
  const ingredientRows: CreateRecipeIngredientForRow[] = [];

  for (let i = 0; i < parsedLines.length; i++) {
    const line = parsedLines[i]!;
    const fp = `ingredients[${i}]`;
    const row = foodRowsById.get(line.foodId);
    if (row === undefined) {
      return { kind: 'invalid_input', field: `${fp}.foodId`, message: 'Unknown food.' };
    }
    const foodMeta = asFoodMetadata(row);
    if (foodMeta === null) {
      return { kind: 'invalid_input', field: `${fp}.foodId`, message: 'Item is not a food.' };
    }

    const gramsRes = gramsForIngredientServing(foodMeta, line.quantity, line.serving, fp);
    if (typeof gramsRes === 'object') {
      return { kind: 'invalid_input', field: gramsRes.field, message: gramsRes.message };
    }

    const scaled = scaleNutrientsToGrams(foodMeta.nutrients, foodMeta.baseAmountGrams, gramsRes);
    if (scaled === null) {
      return {
        kind: 'invalid_input',
        field: `${fp}.quantity`,
        message: 'Could not scale nutrients for this ingredient amount.',
      };
    }

    totals = sumNutrients(totals, scaled);
    const sf = servingToRowFields(line.serving);
    ingredientRows.push({
      ingredientFoodPantryItemId: line.foodId,
      sortOrder: i,
      servingKind: sf.servingKind,
      servingUnitKey: sf.servingUnitKey,
      servingCustomLabel: sf.servingCustomLabel,
      quantity: line.quantity,
    });
  }

  const nutrientsPerServing = scaleNutrientsScalar(totals, 1 / servings);

  const metadata: RecipeItemMetadataWire = {
    kind: 'recipe',
    servings,
    servingLabel: labelRes,
    nutrients: totals,
    nutrientsPerServing,
  };

  return {
    kind: 'ok',
    value: {
      name: nameRes,
      iconKey: iconRes,
      metadata,
      ingredients: ingredientRows,
    },
  };
}

/** Collects valid food UUIDs from `ingredients` for preloading Food rows (deduped). */
export function extractUniqueFoodIdsFromRecipeBody(raw: unknown): string[] | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const ingRaw = (raw as Record<string, unknown>)['ingredients'];
  if (!Array.isArray(ingRaw)) {
    return null;
  }
  const out = new Set<string>();
  for (const entry of ingRaw) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return null;
    }
    const idRaw = (entry as Record<string, unknown>)['foodId'];
    if (typeof idRaw !== 'string') {
      return null;
    }
    const idRes = parseUuid(idRaw, 'foodId');
    if (typeof idRes !== 'string') {
      return null;
    }
    out.add(idRes);
  }
  return [...out];
}
