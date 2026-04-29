<script setup lang="ts">
import { normalizeHealthyApiBaseUrl } from '@/utils/healthyApiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const apiBase = useHealthyApiBaseUrl();

const tab = ref<'food' | 'recipe'>('food');

type PantryWireItem = {
  id: string;
  name: string;
  iconKey: string;
  itemType: string;
  metadata?: Record<string, unknown>;
};

function pantryFoodCaloriesFromList(it: PantryWireItem): number | undefined {
  if (it.itemType !== 'food') {
    return undefined;
  }
  const meta = it.metadata;
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
    return undefined;
  }
  const nutrients = meta['nutrients'];
  if (nutrients === null || typeof nutrients !== 'object' || Array.isArray(nutrients)) {
    return undefined;
  }
  const n = nutrients as Record<string, unknown>;
  const raw = n['calories'];
  return typeof raw === 'number' ? raw : undefined;
}

function pantryRecipeCaloriesPerServingFromList(it: PantryWireItem): number | undefined {
  if (it.itemType !== 'recipe') {
    return undefined;
  }
  const meta = it.metadata;
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
    return undefined;
  }
  const nps = meta['nutrientsPerServing'];
  if (nps === null || typeof nps !== 'object' || Array.isArray(nps)) {
    return undefined;
  }
  const n = nps as Record<string, unknown>;
  const raw = n['calories'];
  return typeof raw === 'number' ? raw : undefined;
}

function pantryItemMatchesActiveTabSearch(
  it: PantryWireItem,
  qTrim: string,
  activeTab: 'food' | 'recipe',
): boolean {
  if (qTrim === '') {
    return true;
  }
  const lower = qTrim.toLowerCase();
  if (it.name.toLowerCase().includes(lower)) {
    return true;
  }
  if (activeTab === 'food') {
    const meta = it.metadata;
    if (meta !== null && typeof meta === 'object' && !Array.isArray(meta)) {
      const b = meta['brand'];
      if (typeof b === 'string' && b.trim() !== '' && b.toLowerCase().includes(lower)) {
        return true;
      }
    }
  }
  return false;
}

const referenceError = ref<string | null>(null);
const nutrientsCount = ref<number | null>(null);
const iconKeysList = ref<string[]>([]);
const servingUnitsCatalog = ref<{ key: string; displayName: string }[]>([]);

/** Optional extra rows for POST `servingOptions` when creating a food */
type ServingDraft = {
  id: number;
  mode: 'unit' | 'custom';
  unitKey: string;
  customLabel: string;
  grams: string;
};

let nextServingDraftId = 0;

function makeEmptyServingDraft(unitFallback: string): ServingDraft {
  const id = nextServingDraftId;
  nextServingDraftId += 1;
  return {
    id,
    mode: 'unit',
    unitKey: unitFallback,
    customLabel: '',
    grams: '',
  };
}

const createFoodServings = ref<ServingDraft[]>([]);

function addServingOptionRow() {
  if (servingUnitsCatalog.value.length === 0) {
    const id = nextServingDraftId;
    nextServingDraftId += 1;
    createFoodServings.value.push({
      id,
      mode: 'custom',
      unitKey: 'slice',
      customLabel: '',
      grams: '',
    });
    return;
  }
  const first = servingUnitsCatalog.value[0]!.key;
  createFoodServings.value = [...createFoodServings.value, makeEmptyServingDraft(first)];
}

function removeServingOptionRow(id: number) {
  createFoodServings.value = createFoodServings.value.filter((r) => r.id !== id);
}

type ServingOptionWire =
  | { kind: 'unit'; unit: string; grams: number }
  | { kind: 'custom'; label: string; grams: number };

function parseServingDraftsIntoPayload():
  | { ok: true; value: ServingOptionWire[] }
  | { ok: false; message: string } {
  const out: ServingOptionWire[] = [];
  for (const d of createFoodServings.value) {
    const gRaw = d.grams.trim();
    const labelTrim = d.customLabel.trim();
    const isBlankRow = d.mode === 'unit' ? gRaw === '' : gRaw === '' && labelTrim === '';
    if (isBlankRow) {
      continue;
    }
    const gNum = Number(gRaw);
    if (!Number.isFinite(gNum) || gNum <= 0) {
      return { ok: false, message: 'Each serving option needs a positive mass in grams.' };
    }
    if (d.mode === 'custom') {
      if (labelTrim === '') {
        return { ok: false, message: 'Custom servings need a label.' };
      }
      out.push({ kind: 'custom', label: labelTrim, grams: gNum });
    } else {
      if (!servingUnitsCatalog.value.some((u) => u.key === d.unitKey)) {
        return { ok: false, message: 'Choose a predefined serving unit for each serving row.' };
      }
      out.push({ kind: 'unit', unit: d.unitKey, grams: gNum });
    }
  }
  return { ok: true, value: out };
}

const items = ref<PantryWireItem[]>([]);
const itemsError = ref<string | null>(null);
const referenceLoading = ref(true);
const itemsLoading = ref(false);
const itemSearchQuery = ref('');

const displayedItems = computed(() => {
  const q = itemSearchQuery.value.trim();
  return items.value.filter((it) => pantryItemMatchesActiveTabSearch(it, q, tab.value));
});

const createFoodName = ref('');
const createFoodBrand = ref('');
const createFoodIconKey = ref('');
const createFoodBaseValue = ref('');
const createFoodBaseUnit = ref<'g' | 'oz'>('g');
const createFoodCalories = ref('');
const createFoodProtein = ref('');
const createFoodFat = ref('');
const createFoodCarbs = ref('');
const createFoodError = ref<string | null>(null);
const createFoodSubmitting = ref(false);

const foodCatalogForRecipes = ref<PantryWireItem[]>([]);
const createRecipeName = ref('');
const createRecipeIconKey = ref('');
const createRecipeServings = ref('');
const createRecipeServingLabel = ref('');
const createRecipeError = ref<string | null>(null);
const createRecipeSubmitting = ref(false);

type RecipeIngredientDraft = {
  id: number;
  foodId: string;
  quantity: string;
  servingMode: 'base' | 'unit' | 'custom';
  unitKey: string;
  customLabel: string;
};

let nextRecipeIngId = 0;

function makeRecipeIngredientRow(): RecipeIngredientDraft {
  const id = nextRecipeIngId;
  nextRecipeIngId += 1;
  const foods = foodCatalogForRecipes.value;
  const firstId = foods[0]?.id ?? '';
  const unitFallback = servingUnitsCatalog.value[0]?.key ?? 'slice';
  return {
    id,
    foodId: firstId,
    quantity: '1',
    servingMode: 'base',
    unitKey: unitFallback,
    customLabel: '',
  };
}

const recipeIngredientRows = ref<RecipeIngredientDraft[]>([]);

function addRecipeIngredientRow() {
  recipeIngredientRows.value = [...recipeIngredientRows.value, makeRecipeIngredientRow()];
}

function removeRecipeIngredientRow(id: number) {
  recipeIngredientRows.value = recipeIngredientRows.value.filter((r) => r.id !== id);
}

function foodHasServingOptions(it: PantryWireItem | undefined): boolean {
  if (it === undefined || it.itemType !== 'food') {
    return false;
  }
  const so = it.metadata?.['servingOptions'];
  return Array.isArray(so) && so.length > 0;
}

function selectedFood(row: RecipeIngredientDraft): PantryWireItem | undefined {
  return foodCatalogForRecipes.value.find((f) => f.id === row.foodId);
}

function syncRecipeRowServingMode(row: RecipeIngredientDraft) {
  const food = selectedFood(row);
  if (!foodHasServingOptions(food)) {
    row.servingMode = 'base';
    return;
  }
  const units = servingUnitKeysForFood(food);
  const labels = customServingLabelsForFood(food);
  if (row.servingMode === 'unit' && units.length === 0 && labels.length > 0) {
    row.servingMode = 'custom';
  }
  if (row.servingMode === 'custom' && labels.length === 0 && units.length > 0) {
    row.servingMode = 'unit';
  }
  if (row.servingMode === 'base') {
    row.servingMode = units.length > 0 ? 'unit' : 'custom';
  }
  if (row.servingMode === 'unit' && units.length > 0 && !units.includes(row.unitKey)) {
    row.unitKey = units[0]!;
  }
  if (row.servingMode === 'custom' && labels.length > 0 && !labels.includes(row.customLabel)) {
    row.customLabel = labels[0]!;
  }
}

function onRecipeIngredientFoodChange(row: RecipeIngredientDraft) {
  syncRecipeRowServingMode(row);
}

type FoodNutrients = {
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
};

function scaleNutrients(n: FoodNutrients, baseG: number, targetG: number): FoodNutrients {
  const f = targetG / baseG;
  return {
    calories: n.calories * f,
    protein: n.protein * f,
    fat: n.fat * f,
    carbohydrates: n.carbohydrates * f,
  };
}

type ServingRowLite =
  | { kind: 'unit'; unit: string; grams: number }
  | { kind: 'custom'; label: string; grams: number };

function parseFoodListMeta(food: PantryWireItem): {
  baseG: number;
  nutrients: FoodNutrients;
  servings: ServingRowLite[];
} | null {
  if (food.itemType !== 'food') {
    return null;
  }
  const meta = food.metadata;
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
    return null;
  }
  if (meta['kind'] !== 'food') {
    return null;
  }
  const baseG = meta['baseAmountGrams'];
  const nutrientsRaw = meta['nutrients'];
  if (typeof baseG !== 'number' || nutrientsRaw === null || typeof nutrientsRaw !== 'object') {
    return null;
  }
  const nr = nutrientsRaw as Record<string, unknown>;
  if (
    typeof nr['calories'] !== 'number' ||
    typeof nr['protein'] !== 'number' ||
    typeof nr['fat'] !== 'number' ||
    typeof nr['carbohydrates'] !== 'number'
  ) {
    return null;
  }
  const nutrients: FoodNutrients = {
    calories: nr['calories'],
    protein: nr['protein'],
    fat: nr['fat'],
    carbohydrates: nr['carbohydrates'],
  };
  const servings: ServingRowLite[] = [];
  const so = meta['servingOptions'];
  if (Array.isArray(so)) {
    for (const e of so) {
      if (e === null || typeof e !== 'object' || Array.isArray(e)) {
        continue;
      }
      const o = e as Record<string, unknown>;
      if (o['kind'] === 'unit' && typeof o['unit'] === 'string' && typeof o['grams'] === 'number') {
        servings.push({ kind: 'unit', unit: o['unit'], grams: o['grams'] });
      } else if (
        o['kind'] === 'custom' &&
        typeof o['label'] === 'string' &&
        typeof o['grams'] === 'number'
      ) {
        servings.push({ kind: 'custom', label: o['label'], grams: o['grams'] });
      }
    }
  }
  return { baseG, nutrients, servings };
}

function servingUnitKeysForFood(food: PantryWireItem | undefined): string[] {
  const p = food === undefined ? null : parseFoodListMeta(food);
  if (p === null) {
    return [];
  }
  return p.servings.filter((s) => s.kind === 'unit').map((s) => s.unit);
}

function customServingLabelsForFood(food: PantryWireItem | undefined): string[] {
  const p = food === undefined ? null : parseFoodListMeta(food);
  if (p === null) {
    return [];
  }
  return p.servings.filter((s) => s.kind === 'custom').map((s) => s.label);
}

function gramsForRecipeDraftRow(row: RecipeIngredientDraft): number | null {
  const food = selectedFood(row);
  if (food === undefined) {
    return null;
  }
  const parsed = parseFoodListMeta(food);
  if (parsed === null) {
    return null;
  }
  const q = Number(row.quantity.trim());
  if (!Number.isFinite(q) || q <= 0) {
    return null;
  }
  const has = parsed.servings.length > 0;
  if (row.servingMode === 'base') {
    if (has) {
      return null;
    }
    return parsed.baseG * q;
  }
  if (!has) {
    return null;
  }
  if (row.servingMode === 'unit') {
    const opt = parsed.servings.find((s) => s.kind === 'unit' && s.unit === row.unitKey);
    if (opt === undefined) {
      return null;
    }
    return opt.grams * q;
  }
  const label = row.customLabel.trim();
  const opt = parsed.servings.find((s) => s.kind === 'custom' && s.label === label);
  if (opt === undefined) {
    return null;
  }
  return opt.grams * q;
}

const recipeDraftPreviewTotals = computed(() => {
  let total: FoodNutrients = { calories: 0, protein: 0, fat: 0, carbohydrates: 0 };
  for (const row of recipeIngredientRows.value) {
    const food = selectedFood(row);
    if (food === undefined) {
      continue;
    }
    const parsed = parseFoodListMeta(food);
    const grams = gramsForRecipeDraftRow(row);
    if (parsed === null || grams === null) {
      continue;
    }
    const part = scaleNutrients(parsed.nutrients, parsed.baseG, grams);
    total = {
      calories: total.calories + part.calories,
      protein: total.protein + part.protein,
      fat: total.fat + part.fat,
      carbohydrates: total.carbohydrates + part.carbohydrates,
    };
  }
  const s = Number(createRecipeServings.value.trim());
  const perServing =
    Number.isFinite(s) && s > 0
      ? {
          calories: total.calories / s,
          protein: total.protein / s,
          fat: total.fat / s,
          carbohydrates: total.carbohydrates / s,
        }
      : null;
  return { total, perServing };
});

function parseRecipeIngredientWire(
  row: RecipeIngredientDraft,
  idx: number,
):
  | { ok: true; value: { foodId: string; quantity: number; servingOption: Record<string, unknown> } }
  | { ok: false; message: string } {
  const food = selectedFood(row);
  if (food === undefined || row.foodId === '') {
    return { ok: false, message: 'Each ingredient needs a food.' };
  }
  const q = Number(row.quantity.trim());
  if (!Number.isFinite(q) || q <= 0) {
    return { ok: false, message: 'Each ingredient needs a positive quantity.' };
  }
  const grams = gramsForRecipeDraftRow(row);
  if (grams === null) {
    return {
      ok: false,
      message: `Ingredient ${idx + 1}: serving choice does not match that food (line up base vs. serving options).`,
    };
  }
  let servingOption: Record<string, unknown>;
  if (row.servingMode === 'base') {
    servingOption = { kind: 'base' };
  } else if (row.servingMode === 'unit') {
    servingOption = { kind: 'unit', unit: row.unitKey };
  } else {
    servingOption = { kind: 'custom', label: row.customLabel.trim() };
  }
  return { ok: true, value: { foodId: row.foodId, quantity: q, servingOption } };
}

async function loadFoodCatalogForRecipes(base: string): Promise<void> {
  try {
    const res = await $fetch<{ items: PantryWireItem[] }>(
      `${normalizeHealthyApiBaseUrl(base)}/pantry/items?itemType=food`,
      { credentials: 'include' },
    );
    foodCatalogForRecipes.value = res.items;
    if (recipeIngredientRows.value.length === 0 && res.items.length > 0) {
      recipeIngredientRows.value = [makeRecipeIngredientRow()];
    } else {
      for (const row of recipeIngredientRows.value) {
        syncRecipeRowServingMode(row);
      }
    }
  } catch {
    foodCatalogForRecipes.value = [];
  }
}

async function submitCreateRecipe() {
  createRecipeError.value = null;
  const resolved = apiBase.value;
  const base = resolved.ok ? resolved.baseUrl : null;
  if (!base) {
    createRecipeError.value = 'API base URL is not configured.';
    return;
  }
  const name = createRecipeName.value.trim();
  if (name === '') {
    createRecipeError.value = 'Name is required.';
    return;
  }
  if (createRecipeIconKey.value === '') {
    createRecipeError.value = 'Choose an icon.';
    return;
  }
  const servings = Number(createRecipeServings.value.trim());
  if (!Number.isFinite(servings) || servings <= 0) {
    createRecipeError.value = 'Servings must be a positive number.';
    return;
  }
  if (recipeIngredientRows.value.length === 0) {
    createRecipeError.value = 'Add at least one ingredient.';
    return;
  }
  const ingredients: { foodId: string; quantity: number; servingOption: Record<string, unknown> }[] =
    [];
  for (let i = 0; i < recipeIngredientRows.value.length; i++) {
    const w = parseRecipeIngredientWire(recipeIngredientRows.value[i]!, i);
    if (!w.ok) {
      createRecipeError.value = w.message;
      return;
    }
    ingredients.push(w.value);
  }
  const labelTrim = createRecipeServingLabel.value.trim();
  createRecipeSubmitting.value = true;
  try {
    await $fetch(`${normalizeHealthyApiBaseUrl(base)}/pantry/items/recipe`, {
      method: 'POST',
      credentials: 'include',
      body: {
        name,
        iconKey: createRecipeIconKey.value,
        servings,
        ...(labelTrim === '' ? {} : { servingLabel: labelTrim }),
        ingredients,
      },
    });
    createRecipeName.value = '';
    createRecipeServings.value = '';
    createRecipeServingLabel.value = '';
    recipeIngredientRows.value = foodCatalogForRecipes.value.length > 0 ? [makeRecipeIngredientRow()] : [];
    await fetchItemsPayload(base);
    await loadFoodCatalogForRecipes(base);
    itemsError.value = null;
  } catch (err: unknown) {
    const data =
      err !== null &&
      typeof err === 'object' &&
      'data' in err &&
      err.data !== null &&
      typeof err.data === 'object'
        ? (err.data as Record<string, unknown>)
        : undefined;
    if (data && data['error'] === 'invalid_input' && typeof data['message'] === 'string') {
      createRecipeError.value = data['message'] as string;
    } else {
      createRecipeError.value = 'Unable to save recipe.';
    }
  } finally {
    createRecipeSubmitting.value = false;
  }
}

async function loadReference(base: string): Promise<boolean> {
  referenceError.value = null;
  try {
    const res = await $fetch<{
      nutrients: { key: string }[];
      iconKeys: string[];
      servingUnits?: { key: string; displayName: string }[];
    }>(`${normalizeHealthyApiBaseUrl(base)}/pantry/reference`, { credentials: 'include' });
    nutrientsCount.value = res.nutrients.length;
    iconKeysList.value = res.iconKeys;
    servingUnitsCatalog.value = res.servingUnits ?? [];
    if (createFoodIconKey.value === '' && res.iconKeys.length > 0) {
      const first = res.iconKeys[0];
      if (first) {
        createFoodIconKey.value = first;
      }
    }
    if (createRecipeIconKey.value === '' && res.iconKeys.length > 0) {
      const first = res.iconKeys[0];
      if (first) {
        createRecipeIconKey.value = first;
      }
    }
    return true;
  } catch {
    referenceError.value = 'Unable to load nutrient catalog.';
    nutrientsCount.value = null;
    iconKeysList.value = [];
    servingUnitsCatalog.value = [];
    createFoodServings.value = [];
    return false;
  }
}

async function fetchItemsPayload(base: string): Promise<void> {
  const q = tab.value === 'food' ? 'food' : 'recipe';
  const res = await $fetch<{ items: PantryWireItem[] }>(
    `${normalizeHealthyApiBaseUrl(base)}/pantry/items?itemType=${encodeURIComponent(q)}`,
    { credentials: 'include' },
  );
  items.value = res.items;
}

async function reloadItems(base: string) {
  itemsError.value = null;
  itemsLoading.value = true;
  try {
    await fetchItemsPayload(base);
  } catch {
    itemsError.value = 'Unable to load your Pantry.';
    items.value = [];
  } finally {
    itemsLoading.value = false;
  }
}

async function hydrate() {
  const resolved = apiBase.value;
  const base = resolved.ok ? resolved.baseUrl : null;
  if (!base) {
    referenceLoading.value = false;
    referenceError.value = 'API base URL is not configured.';
    return;
  }

  referenceLoading.value = true;
  referenceError.value = null;

  try {
    const ok = await loadReference(base);
    if (!ok) {
      return;
    }
    await fetchItemsPayload(base);
    itemsError.value = null;
  } catch {
    itemsError.value = 'Unable to load your Pantry.';
    items.value = [];
  } finally {
    referenceLoading.value = false;
  }
}

function parseNonNegNumber(raw: string, label: string): number | null {
  const t = raw.trim();
  if (t === '') {
    createFoodError.value = `${label} is required.`;
    return null;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) {
    createFoodError.value = `${label} must be a number.`;
    return null;
  }
  if (n < 0) {
    createFoodError.value = `${label} cannot be negative.`;
    return null;
  }
  return n;
}

async function submitCreateFood() {
  createFoodError.value = null;
  const resolved = apiBase.value;
  const base = resolved.ok ? resolved.baseUrl : null;
  if (!base) {
    createFoodError.value = 'API base URL is not configured.';
    return;
  }

  const name = createFoodName.value.trim();
  if (name === '') {
    createFoodError.value = 'Name is required.';
    return;
  }
  const baseValRaw = createFoodBaseValue.value.trim();
  if (baseValRaw === '') {
    createFoodError.value = 'Base amount is required.';
    return;
  }
  const baseVal = Number(baseValRaw);
  if (!Number.isFinite(baseVal) || baseVal <= 0) {
    createFoodError.value = 'Base amount must be a positive number.';
    return;
  }

  const cal = parseNonNegNumber(createFoodCalories.value, 'Calories');
  if (cal === null) {
    return;
  }
  const protein = parseNonNegNumber(createFoodProtein.value, 'Protein');
  if (protein === null) {
    return;
  }
  const fat = parseNonNegNumber(createFoodFat.value, 'Fat');
  if (fat === null) {
    return;
  }
  const carbs = parseNonNegNumber(createFoodCarbs.value, 'Carbohydrates');
  if (carbs === null) {
    return;
  }

  if (createFoodIconKey.value === '') {
    createFoodError.value = 'Choose an icon.';
    return;
  }

  const brandTrim = createFoodBrand.value.trim();

  const servingsParsed = parseServingDraftsIntoPayload();
  if (!servingsParsed.ok) {
    createFoodError.value = servingsParsed.message;
    return;
  }

  createFoodSubmitting.value = true;
  try {
    await $fetch(`${normalizeHealthyApiBaseUrl(base)}/pantry/items/food`, {
      method: 'POST',
      credentials: 'include',
      body: {
        name,
        ...(brandTrim === '' ? {} : { brand: brandTrim }),
        iconKey: createFoodIconKey.value,
        baseAmount: { value: baseVal, unit: createFoodBaseUnit.value },
        nutrients: {
          calories: cal,
          protein,
          fat,
          carbohydrates: carbs,
        },
        ...(servingsParsed.value.length > 0 ? { servingOptions: servingsParsed.value } : {}),
      },
    });
    createFoodName.value = '';
    createFoodBrand.value = '';
    createFoodBaseValue.value = '';
    createFoodCalories.value = '';
    createFoodProtein.value = '';
    createFoodFat.value = '';
    createFoodCarbs.value = '';
    createFoodServings.value = [];
    await fetchItemsPayload(base);
    itemsError.value = null;
  } catch (err: unknown) {
    const data =
      err !== null &&
      typeof err === 'object' &&
      'data' in err &&
      err.data !== null &&
      typeof err.data === 'object'
        ? (err.data as Record<string, unknown>)
        : undefined;
    if (data && data['error'] === 'invalid_input' && typeof data['message'] === 'string') {
      createFoodError.value = data['message'] as string;
    } else {
      createFoodError.value = 'Unable to save food.';
    }
  } finally {
    createFoodSubmitting.value = false;
  }
}

onMounted(async () => {
  await hydrate();
});

watch(tab, async () => {
  itemSearchQuery.value = '';
  const resolved = apiBase.value;
  const base = resolved.ok ? resolved.baseUrl : null;
  if (!base || referenceError.value !== null || referenceLoading.value) {
    return;
  }
  await reloadItems(base);
  if (tab.value === 'recipe') {
    await loadFoodCatalogForRecipes(base);
  }
});
</script>

<template>
  <section aria-labelledby="pantry-title" class="max-w-3xl space-y-6">
    <h1 id="pantry-title" class="text-2xl font-semibold tracking-tight">Pantry</h1>

    <p class="text-muted-foreground max-w-prose text-sm">
      Browse foods and recipes you save for logging. Tabs load from your server-backed catalog.
    </p>

    <div
      class="flex gap-2 border-border border-b"
      role="tablist"
      aria-label="Pantry item categories"
    >
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'food'"
        class="relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="
          tab === 'food'
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        data-testid="pantry-tab-food"
        @click="tab = 'food'"
      >
        Foods
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'recipe'"
        class="relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="
          tab === 'recipe'
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        data-testid="pantry-tab-recipes"
        @click="tab = 'recipe'"
      >
        Recipes
      </button>
    </div>

    <div
      v-if="referenceError"
      class="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
      role="alert"
      data-testid="pantry-reference-error"
    >
      {{ referenceError }}
    </div>

    <div
      v-else-if="!referenceLoading && nutrientsCount !== null"
      class="text-muted-foreground text-xs"
      data-testid="pantry-catalog-health"
    >
      Nutrients in catalog:
      {{ nutrientsCount }}
      · Icon keys:
      {{ iconKeysList.length }}
    </div>

    <div v-if="!referenceLoading && referenceError === null && !itemsLoading" class="space-y-1.5">
      <Label for="pantry-items-search" class="sr-only">{{
        tab === 'food' ? 'Search foods' : 'Search recipes'
      }}</Label>
      <Input
        id="pantry-items-search"
        v-model="itemSearchQuery"
        type="search"
        autocomplete="off"
        :placeholder="tab === 'food' ? 'Search foods by name or brand…' : 'Search recipes by name…'"
        data-testid="pantry-items-search"
      />
    </div>

    <Card
      v-if="tab === 'food' && !referenceLoading && referenceError === null"
      class="px-4"
      data-testid="pantry-create-food-card"
    >
      <CardHeader class="px-0 pt-0">
        <CardTitle class="text-base">Add a food</CardTitle>
        <CardDescription>
          Name, base amount (grams or ounces), icon, and required macros are saved to your private
          catalog.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3 px-0 pb-0">
        <div
          v-if="createFoodError"
          class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-testid="pantry-create-food-error"
        >
          {{ createFoodError }}
        </div>
        <form class="space-y-3" @submit.prevent="submitCreateFood">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="pantry-food-name">Name</Label>
              <Input
                id="pantry-food-name"
                v-model="createFoodName"
                type="text"
                required
                autocomplete="off"
                data-testid="pantry-create-food-name"
              />
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="pantry-food-brand"
                >Brand <span class="text-muted-foreground">(optional)</span></Label
              >
              <Input
                id="pantry-food-brand"
                v-model="createFoodBrand"
                type="text"
                autocomplete="off"
                data-testid="pantry-create-food-brand"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="pantry-food-icon">Icon</Label>
              <select
                id="pantry-food-icon"
                v-model="createFoodIconKey"
                class="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                data-testid="pantry-create-food-icon"
              >
                <option v-for="k in iconKeysList" :key="k" :value="k">
                  {{ k }}
                </option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1.5">
                <Label for="pantry-base-value">Base amount</Label>
                <Input
                  id="pantry-base-value"
                  v-model="createFoodBaseValue"
                  type="text"
                  inputmode="decimal"
                  data-testid="pantry-create-food-base-value"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="pantry-base-unit">Unit</Label>
                <select
                  id="pantry-base-unit"
                  v-model="createFoodBaseUnit"
                  class="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                  data-testid="pantry-create-food-base-unit"
                >
                  <option value="g">g</option>
                  <option value="oz">oz</option>
                </select>
              </div>
            </div>
            <div class="space-y-1.5">
              <Label for="pantry-n-cal">Calories (kcal)</Label>
              <Input
                id="pantry-n-cal"
                v-model="createFoodCalories"
                type="text"
                inputmode="decimal"
                data-testid="pantry-create-food-calories"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="pantry-n-protein">Protein (g)</Label>
              <Input
                id="pantry-n-protein"
                v-model="createFoodProtein"
                type="text"
                inputmode="decimal"
                data-testid="pantry-create-food-protein"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="pantry-n-fat">Fat (g)</Label>
              <Input
                id="pantry-n-fat"
                v-model="createFoodFat"
                type="text"
                inputmode="decimal"
                data-testid="pantry-create-food-fat"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="pantry-n-carbs">Carbohydrates (g)</Label>
              <Input
                id="pantry-n-carbs"
                v-model="createFoodCarbs"
                type="text"
                inputmode="decimal"
                data-testid="pantry-create-food-carbs"
              />
            </div>
          </div>

          <div class="border-border space-y-3 border-t pt-3">
            <div>
              <p class="text-sm font-medium">
                Serving options <span class="text-muted-foreground font-normal">(optional)</span>
              </p>
              <p class="text-muted-foreground mt-0.5 text-xs">
                Add practical portions (predefined units or a custom label). Each row is a mass in
                grams for one serving; nutrients scale from your base amount above.
              </p>
            </div>
            <div
              v-for="row in createFoodServings"
              :key="row.id"
              class="bg-muted/30 flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-end"
            >
              <div class="grid flex-1 gap-2 sm:grid-cols-3">
                <div class="space-y-1.5">
                  <Label :for="`serving-mode-${row.id}`">Type</Label>
                  <select
                    :id="`serving-mode-${row.id}`"
                    v-model="row.mode"
                    class="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                  >
                    <option value="unit" :disabled="servingUnitsCatalog.length === 0">
                      Predefined unit
                    </option>
                    <option value="custom">Custom label</option>
                  </select>
                </div>
                <div v-if="row.mode === 'unit'" class="space-y-1.5">
                  <Label :for="`serving-unit-${row.id}`">Unit</Label>
                  <select
                    :id="`serving-unit-${row.id}`"
                    v-model="row.unitKey"
                    class="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                    :disabled="servingUnitsCatalog.length === 0"
                  >
                    <option v-for="u in servingUnitsCatalog" :key="u.key" :value="u.key">
                      {{ u.displayName }}
                    </option>
                  </select>
                </div>
                <div v-else class="space-y-1.5 sm:col-span-1">
                  <Label :for="`serving-label-${row.id}`">Label</Label>
                  <Input
                    :id="`serving-label-${row.id}`"
                    v-model="row.customLabel"
                    type="text"
                    autocomplete="off"
                    placeholder="e.g. half bar"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label :for="`serving-grams-${row.id}`">Grams per serving</Label>
                  <Input
                    :id="`serving-grams-${row.id}`"
                    v-model="row.grams"
                    type="text"
                    inputmode="decimal"
                    placeholder="e.g. 30"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                class="shrink-0"
                @click="removeServingOptionRow(row.id)"
              >
                Remove
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              data-testid="pantry-create-food-add-serving"
              @click="addServingOptionRow"
            >
              Add serving option
            </Button>
          </div>
          <Button
            type="submit"
            :disabled="createFoodSubmitting"
            data-testid="pantry-create-food-submit"
          >
            Save food
          </Button>
        </form>
      </CardContent>
    </Card>

    <Card
      v-if="tab === 'recipe' && !referenceLoading && referenceError === null"
      class="px-4"
      data-testid="pantry-create-recipe-card"
    >
      <CardHeader class="px-0 pt-0">
        <CardTitle class="text-base">Add a recipe</CardTitle>
        <CardDescription>
          Name, icon, yield, and food ingredients. Calories and macros are computed from your foods
          and serving choices—nothing typed by hand.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3 px-0 pb-0">
        <div
          v-if="createRecipeError"
          class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-testid="pantry-create-recipe-error"
        >
          {{ createRecipeError }}
        </div>
        <p
          v-if="foodCatalogForRecipes.length === 0"
          class="text-muted-foreground text-sm"
          data-testid="pantry-create-recipe-no-foods"
        >
          Save at least one food first, then you can combine foods into a recipe here.
        </p>
        <form v-else class="space-y-3" @submit.prevent="submitCreateRecipe">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="pantry-recipe-name">Name</Label>
              <Input
                id="pantry-recipe-name"
                v-model="createRecipeName"
                type="text"
                autocomplete="off"
                data-testid="pantry-create-recipe-name"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="pantry-recipe-icon">Icon</Label>
              <select
                id="pantry-recipe-icon"
                v-model="createRecipeIconKey"
                class="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                data-testid="pantry-create-recipe-icon"
              >
                <option v-for="k in iconKeysList" :key="k" :value="k">
                  {{ k }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label for="pantry-recipe-servings">Servings (yield)</Label>
              <Input
                id="pantry-recipe-servings"
                v-model="createRecipeServings"
                type="text"
                inputmode="decimal"
                placeholder="e.g. 4"
                data-testid="pantry-create-recipe-servings"
              />
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="pantry-recipe-serving-label">
                Serving label <span class="text-muted-foreground">(optional, default “serving”)</span>
              </Label>
              <Input
                id="pantry-recipe-serving-label"
                v-model="createRecipeServingLabel"
                type="text"
                autocomplete="off"
                placeholder="serving"
                data-testid="pantry-create-recipe-serving-label"
              />
            </div>
          </div>

          <div class="border-border space-y-2 border-t pt-3">
            <p class="text-sm font-medium">Ingredients</p>
            <div
              v-for="row in recipeIngredientRows"
              :key="row.id"
              class="bg-muted/30 flex flex-col gap-2 rounded-md border border-border p-3"
            >
              <div class="grid gap-2 sm:grid-cols-2">
                <div class="space-y-1.5 sm:col-span-2">
                  <Label :for="`recipe-ing-food-${row.id}`">Food</Label>
                  <select
                    :id="`recipe-ing-food-${row.id}`"
                    v-model="row.foodId"
                    class="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                    @change="onRecipeIngredientFoodChange(row)"
                  >
                    <option v-for="f in foodCatalogForRecipes" :key="f.id" :value="f.id">
                      {{ f.name }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label :for="`recipe-ing-qty-${row.id}`">Quantity</Label>
                  <Input
                    :id="`recipe-ing-qty-${row.id}`"
                    v-model="row.quantity"
                    type="text"
                    inputmode="decimal"
                  />
                </div>
                <div v-if="!foodHasServingOptions(selectedFood(row))" class="space-y-1.5">
                  <Label>Serving</Label>
                  <p class="text-muted-foreground text-xs">Uses this food’s base amount.</p>
                </div>
                <template v-else>
                  <div class="space-y-1.5">
                    <Label :for="`recipe-ing-serv-mode-${row.id}`">Serving type</Label>
                    <select
                      :id="`recipe-ing-serv-mode-${row.id}`"
                      v-model="row.servingMode"
                      class="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                    >
                      <option value="unit">Predefined unit</option>
                      <option value="custom">Custom label</option>
                    </select>
                  </div>
                  <div v-if="row.servingMode === 'unit'" class="space-y-1.5">
                    <Label :for="`recipe-ing-unit-${row.id}`">Unit</Label>
                    <select
                      :id="`recipe-ing-unit-${row.id}`"
                      v-model="row.unitKey"
                      class="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                    >
                      <option
                        v-for="u in servingUnitKeysForFood(selectedFood(row))"
                        :key="u"
                        :value="u"
                      >
                        {{ u }}
                      </option>
                    </select>
                  </div>
                  <div v-else class="space-y-1.5 sm:col-span-2">
                    <Label :for="`recipe-ing-custom-${row.id}`">Custom label</Label>
                    <select
                      :id="`recipe-ing-custom-${row.id}`"
                      v-model="row.customLabel"
                      class="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
                    >
                      <option
                        v-for="l in customServingLabelsForFood(selectedFood(row))"
                        :key="l"
                        :value="l"
                      >
                        {{ l }}
                      </option>
                    </select>
                  </div>
                </template>
              </div>
              <Button type="button" variant="outline" @click="removeRecipeIngredientRow(row.id)">
                Remove ingredient
              </Button>
            </div>
            <Button type="button" variant="secondary" @click="addRecipeIngredientRow">
              Add ingredient
            </Button>
          </div>

          <div
            v-if="recipeDraftPreviewTotals.perServing"
            class="text-muted-foreground rounded-md border border-border bg-muted/20 px-3 py-2 text-xs"
            data-testid="pantry-create-recipe-preview"
          >
            <p class="font-medium text-foreground">Preview (computed)</p>
            <p class="tabular-nums">
              Total:
              {{ recipeDraftPreviewTotals.total.calories.toFixed(0) }} kcal · Per serving ({{
                createRecipeServings.trim() || '—'
              }}
              ):
              {{ recipeDraftPreviewTotals.perServing.calories.toFixed(0) }} kcal
            </p>
          </div>

          <Button
            type="submit"
            :disabled="createRecipeSubmitting"
            data-testid="pantry-create-recipe-submit"
          >
            Save recipe
          </Button>
        </form>
      </CardContent>
    </Card>

    <div v-if="referenceLoading || itemsLoading" class="text-muted-foreground text-sm">
      Loading…
    </div>

    <div
      v-else-if="itemsError"
      class="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
      role="alert"
    >
      {{ itemsError }}
    </div>

    <div
      v-else-if="items.length === 0"
      class="text-muted-foreground text-sm"
      data-testid="pantry-empty"
    >
      No {{ tab === 'food' ? 'foods' : 'recipes' }} yet. Saved items appear here once you add them.
    </div>

    <div
      v-else-if="displayedItems.length === 0"
      class="text-muted-foreground text-sm"
      data-testid="pantry-search-no-matches"
    >
      No {{ tab === 'food' ? 'foods' : 'recipes' }} match your search.
    </div>

    <ul
      v-else
      class="divide-y divide-border rounded-md border border-border"
      :aria-label="tab === 'food' ? 'Foods in your pantry' : 'Recipes in your pantry'"
    >
      <li
        v-for="it in displayedItems"
        :key="it.id"
        class="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm"
      >
        <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span class="text-muted-foreground shrink-0 font-mono text-xs">{{ it.iconKey }}</span>
          <NuxtLink
            v-if="tab === 'food'"
            class="font-medium text-foreground hover:underline"
            :to="`/pantry/food/${it.id}`"
            data-testid="pantry-food-item-link"
          >
            {{ it.name }}
          </NuxtLink>
          <NuxtLink
            v-else
            class="font-medium text-foreground hover:underline"
            :to="`/pantry/recipe/${it.id}`"
            data-testid="pantry-recipe-item-link"
          >
            {{ it.name }}
          </NuxtLink>
        </div>
        <span
          v-if="tab === 'food' && pantryFoodCaloriesFromList(it) != null"
          class="text-muted-foreground shrink-0 whitespace-nowrap text-xs tabular-nums"
          data-testid="pantry-food-item-cal"
        >
          {{ pantryFoodCaloriesFromList(it) }} kcal
        </span>
        <span
          v-else-if="tab === 'recipe' && pantryRecipeCaloriesPerServingFromList(it) != null"
          class="text-muted-foreground shrink-0 whitespace-nowrap text-xs tabular-nums"
          data-testid="pantry-recipe-item-cal"
        >
          {{ Math.round(pantryRecipeCaloriesPerServingFromList(it)!) }} kcal / serving
        </span>
      </li>
    </ul>
  </section>
</template>
