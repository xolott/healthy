import type { NewFoodLogEntryRow, PantryItemRow, ReferenceFoodRow } from '@healthy/db/schema';

import { scaleNutrientsToGrams } from '../pantry/create-food-payload.js';
import {
  foodItemMetadataFromPantryRow,
  gramsForIngredientServing,
  nutrientsForRecipeIngredientServing,
  parseIngredientServingOption,
  parseQuantity,
  parseUuid,
  recipeItemMetadataFromPantryRow,
  type RecipeIngredientServingWire,
} from '../pantry/create-recipe-payload.js';

export type PlanFoodLogBatchResult =
  | { kind: 'invalid_input'; field: string; message: string }
  | { kind: 'ok'; rows: NewFoodLogEntryRow[] };

function servingWireToRowFields(
  serving: RecipeIngredientServingWire,
): Pick<NewFoodLogEntryRow, 'servingKind' | 'servingUnitKey' | 'servingCustomLabel'> {
  if (serving.kind === 'base') {
    return { servingKind: 'base', servingUnitKey: null, servingCustomLabel: null };
  }
  if (serving.kind === 'unit') {
    return { servingKind: 'unit', servingUnitKey: serving.unit, servingCustomLabel: null };
  }
  return {
    servingKind: 'custom',
    servingUnitKey: null,
    servingCustomLabel: serving.label,
  };
}

function parseLocalDateString(
  raw: unknown,
  field: string,
): string | { field: string; message: string } {
  if (typeof raw !== 'string') {
    return { field, message: 'Must be a string.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { field, message: 'Must be a local date in YYYY-MM-DD form.' };
  }
  const parts = raw.split('-').map((x) => Number(x));
  if (parts.length !== 3) {
    return { field, message: 'Must be a valid calendar date.' };
  }
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  if (
    !Number.isInteger(y) ||
    !Number.isInteger(m) ||
    !Number.isInteger(d) ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    return { field, message: 'Must be a valid calendar date.' };
  }
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return { field, message: 'Must be a valid calendar date.' };
  }
  return raw;
}

function parseConsumedAtIso(raw: unknown): Date | { field: string; message: string } {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { field: 'consumedAt', message: 'Must be a non-empty ISO-8601 string.' };
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return { field: 'consumedAt', message: 'Must be a valid ISO-8601 timestamp.' };
  }
  return d;
}

/**
 * Validates batch shape enough to resolve Pantry and Reference Food rows.
 */
export function collectFoodLogBatchResolutionIds(
  rawBody: unknown,
):
  | { kind: 'invalid_input'; field: string; message: string }
  | { kind: 'ok'; pantryIds: string[]; referenceIds: string[] } {
  if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return { kind: 'invalid_input', field: 'body', message: 'Expected a JSON object.' };
  }
  const body = rawBody as Record<string, unknown>;

  const dateRes = parseLocalDateString(body['consumedDate'], 'consumedDate');
  if (typeof dateRes !== 'string') {
    return { kind: 'invalid_input', field: dateRes.field, message: dateRes.message };
  }

  const atRes = parseConsumedAtIso(body['consumedAt']);
  if (!(atRes instanceof Date)) {
    return { kind: 'invalid_input', field: atRes.field, message: atRes.message };
  }

  const entriesRaw = body['entries'];
  if (!Array.isArray(entriesRaw)) {
    return { kind: 'invalid_input', field: 'entries', message: 'Must be an array.' };
  }
  if (entriesRaw.length === 0) {
    return { kind: 'invalid_input', field: 'entries', message: 'Must have at least one entry.' };
  }
  if (entriesRaw.length > 64) {
    return { kind: 'invalid_input', field: 'entries', message: 'Must have at most 64 entries.' };
  }

  const pantryIds: string[] = [];
  const pantrySeen = new Set<string>();
  const referenceIds: string[] = [];
  const referenceSeen = new Set<string>();

  for (let i = 0; i < entriesRaw.length; i++) {
    const fp = `entries[${i}]`;
    const entry = entriesRaw[i];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return { kind: 'invalid_input', field: fp, message: 'Must be an object.' };
    }
    const o = entry as Record<string, unknown>;
    const hasPantry = 'pantryItemId' in o && o['pantryItemId'] !== undefined && o['pantryItemId'] !== null;
    const hasRef = 'referenceFoodId' in o && o['referenceFoodId'] !== undefined && o['referenceFoodId'] !== null;
    if (hasPantry && hasRef) {
      return {
        kind: 'invalid_input',
        field: fp,
        message: 'Each entry must specify either pantryItemId or referenceFoodId, not both.',
      };
    }
    if (!hasPantry && !hasRef) {
      return {
        kind: 'invalid_input',
        field: fp,
        message: 'Each entry must include pantryItemId or referenceFoodId.',
      };
    }
    if (hasPantry) {
      const idRes = parseUuid(o['pantryItemId'], `${fp}.pantryItemId`);
      if (typeof idRes !== 'string') {
        return { kind: 'invalid_input', field: idRes.field, message: idRes.message };
      }
      if (!pantrySeen.has(idRes)) {
        pantrySeen.add(idRes);
        pantryIds.push(idRes);
      }
      continue;
    }
    const idRes = parseUuid(o['referenceFoodId'], `${fp}.referenceFoodId`);
    if (typeof idRes !== 'string') {
      return { kind: 'invalid_input', field: idRes.field, message: idRes.message };
    }
    if (!referenceSeen.has(idRes)) {
      referenceSeen.add(idRes);
      referenceIds.push(idRes);
    }
  }
  return { kind: 'ok', pantryIds, referenceIds };
}

export function parseFoodLogLocalDateQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const r = parseLocalDateString(raw, 'date');
  return typeof r === 'string' ? r : null;
}

/**
 * Builds insert rows for a Food Log batch from parsed JSON and resolved Pantry / Reference rows.
 */
export function planFoodLogBatch(
  ownerUserId: string,
  rawBody: unknown,
  pantryById: Map<string, PantryItemRow>,
  referenceById: Map<string, ReferenceFoodRow>,
  now: Date,
): PlanFoodLogBatchResult {
  if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return { kind: 'invalid_input', field: 'body', message: 'Expected a JSON object.' };
  }
  const body = rawBody as Record<string, unknown>;

  const dateRes = parseLocalDateString(body['consumedDate'], 'consumedDate');
  if (typeof dateRes !== 'string') {
    return { kind: 'invalid_input', field: dateRes.field, message: dateRes.message };
  }
  const consumedDate = dateRes;

  const atRes = parseConsumedAtIso(body['consumedAt']);
  let consumedAt: Date;
  if (atRes instanceof Date) {
    consumedAt = atRes;
  } else {
    return { kind: 'invalid_input', field: atRes.field, message: atRes.message };
  }
  const updatedAt = now;

  const entriesRaw = body['entries'];
  if (!Array.isArray(entriesRaw)) {
    return { kind: 'invalid_input', field: 'entries', message: 'Must be an array.' };
  }
  if (entriesRaw.length === 0) {
    return { kind: 'invalid_input', field: 'entries', message: 'Must have at least one entry.' };
  }
  if (entriesRaw.length > 64) {
    return { kind: 'invalid_input', field: 'entries', message: 'Must have at most 64 entries.' };
  }

  const rows: NewFoodLogEntryRow[] = [];

  for (let i = 0; i < entriesRaw.length; i++) {
    const fp = `entries[${i}]`;
    const entry = entriesRaw[i];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return { kind: 'invalid_input', field: fp, message: 'Must be an object.' };
    }
    const o = entry as Record<string, unknown>;
    const hasPantry = 'pantryItemId' in o && o['pantryItemId'] !== undefined && o['pantryItemId'] !== null;
    const hasRef = 'referenceFoodId' in o && o['referenceFoodId'] !== undefined && o['referenceFoodId'] !== null;

    if (hasRef) {
      const refIdRes = parseUuid(o['referenceFoodId'], `${fp}.referenceFoodId`);
      if (typeof refIdRes !== 'string') {
        return { kind: 'invalid_input', field: refIdRes.field, message: refIdRes.message };
      }
      const refRow = referenceById.get(refIdRes);
      if (refRow === undefined) {
        return {
          kind: 'invalid_input',
          field: `${fp}.referenceFoodId`,
          message: 'Reference Food not found.',
        };
      }
      if (o['quantity'] !== undefined || o['servingOption'] !== undefined) {
        return {
          kind: 'invalid_input',
          field: fp,
          message: 'Reference Food entries must use grams only (no quantity or servingOption).',
        };
      }
      const gramsRes = parseQuantity(o['grams'], `${fp}.grams`);
      if (typeof gramsRes !== 'number') {
        return { kind: 'invalid_input', field: gramsRes.field, message: gramsRes.message };
      }
      const scaled = scaleNutrientsToGrams(
        {
          calories: refRow.calories,
          protein: refRow.proteinGrams,
          fat: refRow.fatGrams,
          carbohydrates: refRow.carbohydratesGrams,
        },
        refRow.baseAmountGrams,
        gramsRes,
      );
      if (scaled === null) {
        return {
          kind: 'invalid_input',
          field: fp,
          message: 'Could not scale nutrients for the requested grams.',
        };
      }
      rows.push({
        ownerUserId,
        itemSource: 'reference_food',
        pantryItemId: null,
        pantryItemType: null,
        referenceFoodId: refRow.id,
        referenceFoodSource: refRow.source,
        referenceSourceFoodId: refRow.sourceFoodId,
        displayName: refRow.displayName,
        iconKey: refRow.iconKey,
        consumedAt,
        consumedDate,
        quantity: gramsRes,
        calories: scaled.calories,
        proteinGrams: scaled.protein,
        fatGrams: scaled.fat,
        carbohydratesGrams: scaled.carbohydrates,
        updatedAt,
        servingKind: 'custom',
        servingUnitKey: null,
        servingCustomLabel: 'g',
      });
      continue;
    }

    const idRes = parseUuid(o['pantryItemId'], `${fp}.pantryItemId`);
    if (typeof idRes !== 'string') {
      return { kind: 'invalid_input', field: idRes.field, message: idRes.message };
    }
    const pantryRow = pantryById.get(idRes);
    if (pantryRow === undefined) {
      return {
        kind: 'invalid_input',
        field: `${fp}.pantryItemId`,
        message: 'Pantry item not found for this owner.',
      };
    }

    if (o['grams'] !== undefined) {
      return {
        kind: 'invalid_input',
        field: fp,
        message: 'Pantry entries must not include grams; use quantity and servingOption.',
      };
    }

    const qRes = parseQuantity(o['quantity'], `${fp}.quantity`);
    if (typeof qRes !== 'number') {
      return { kind: 'invalid_input', field: qRes.field, message: qRes.message };
    }

    const servingRes = parseIngredientServingOption(o['servingOption'], fp);
    if ('field' in servingRes) {
      return { kind: 'invalid_input', field: servingRes.field, message: servingRes.message };
    }
    const serving = servingRes;

    const servingFields = servingWireToRowFields(serving);

    if (pantryRow.itemType === 'food') {
      const foodMeta = foodItemMetadataFromPantryRow(pantryRow);
      if (foodMeta === null) {
        return {
          kind: 'invalid_input',
          field: `${fp}.pantryItemId`,
          message: 'Pantry food metadata is invalid for logging.',
        };
      }
      const gramsRes = gramsForIngredientServing(foodMeta, qRes, serving, fp);
      if (typeof gramsRes !== 'number') {
        return { kind: 'invalid_input', field: gramsRes.field, message: gramsRes.message };
      }
      const scaled = scaleNutrientsToGrams(foodMeta.nutrients, foodMeta.baseAmountGrams, gramsRes);
      if (scaled === null) {
        return {
          kind: 'invalid_input',
          field: fp,
          message: 'Could not scale nutrients for this serving.',
        };
      }
      rows.push({
        ownerUserId,
        itemSource: 'pantry',
        pantryItemId: pantryRow.id,
        pantryItemType: 'food',
        referenceFoodId: null,
        referenceFoodSource: null,
        referenceSourceFoodId: null,
        displayName: pantryRow.name,
        iconKey: pantryRow.iconKey,
        consumedAt,
        consumedDate,
        quantity: qRes,
        calories: scaled.calories,
        proteinGrams: scaled.protein,
        fatGrams: scaled.fat,
        carbohydratesGrams: scaled.carbohydrates,
        updatedAt,
        ...servingFields,
      });
      continue;
    }

    const recipeMeta = recipeItemMetadataFromPantryRow(pantryRow);
    if (recipeMeta === null) {
      return {
        kind: 'invalid_input',
        field: `${fp}.pantryItemId`,
        message: 'Pantry recipe metadata is invalid for logging.',
      };
    }
    const nRes = nutrientsForRecipeIngredientServing(recipeMeta, qRes, serving, fp);
    if ('field' in nRes) {
      return { kind: 'invalid_input', field: nRes.field, message: nRes.message };
    }
    rows.push({
      ownerUserId,
      itemSource: 'pantry',
      pantryItemId: pantryRow.id,
      pantryItemType: 'recipe',
      referenceFoodId: null,
      referenceFoodSource: null,
      referenceSourceFoodId: null,
      displayName: pantryRow.name,
      iconKey: pantryRow.iconKey,
      consumedAt,
      consumedDate,
      quantity: qRes,
      calories: nRes.calories,
      proteinGrams: nRes.protein,
      fatGrams: nRes.fat,
      carbohydratesGrams: nRes.carbohydrates,
      updatedAt,
      ...servingFields,
    });
  }

  return { kind: 'ok', rows };
}
