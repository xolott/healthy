<script setup lang="ts">
import { normalizeHealthyApiBaseUrl } from "@/utils/healthyApiClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const apiBase = useHealthyApiBaseUrl();

const tab = ref<"food" | "recipe">("food");

type PantryWireItem = {
  id: string;
  name: string;
  iconKey: string;
  itemType: string;
};

const referenceError = ref<string | null>(null);
const nutrientsCount = ref<number | null>(null);
const iconKeysList = ref<string[]>([]);

const items = ref<PantryWireItem[]>([]);
const itemsError = ref<string | null>(null);
const referenceLoading = ref(true);
const itemsLoading = ref(false);

const createFoodName = ref("");
const createFoodBrand = ref("");
const createFoodIconKey = ref("");
const createFoodBaseValue = ref("");
const createFoodBaseUnit = ref<"g" | "oz">("g");
const createFoodCalories = ref("");
const createFoodProtein = ref("");
const createFoodFat = ref("");
const createFoodCarbs = ref("");
const createFoodError = ref<string | null>(null);
const createFoodSubmitting = ref(false);

async function loadReference(base: string): Promise<boolean> {
  referenceError.value = null;
  try {
    const res = await $fetch<{ nutrients: { key: string }[]; iconKeys: string[] }>(
      `${normalizeHealthyApiBaseUrl(base)}/pantry/reference`,
      { credentials: "include" },
    );
    nutrientsCount.value = res.nutrients.length;
    iconKeysList.value = res.iconKeys;
    if (createFoodIconKey.value === "" && res.iconKeys.length > 0) {
      const first = res.iconKeys[0];
      if (first) {
        createFoodIconKey.value = first;
      }
    }
    return true;
  } catch {
    referenceError.value = "Unable to load nutrient catalog.";
    nutrientsCount.value = null;
    iconKeysList.value = [];
    return false;
  }
}

async function fetchItemsPayload(base: string): Promise<void> {
  const q = tab.value === "food" ? "food" : "recipe";
  const res = await $fetch<{ items: PantryWireItem[] }>(
    `${normalizeHealthyApiBaseUrl(base)}/pantry/items?itemType=${encodeURIComponent(q)}`,
    { credentials: "include" },
  );
  items.value = res.items;
}

async function reloadItems(base: string) {
  itemsError.value = null;
  itemsLoading.value = true;
  try {
    await fetchItemsPayload(base);
  } catch {
    itemsError.value = "Unable to load your Pantry.";
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
    referenceError.value = "API base URL is not configured.";
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
    itemsError.value = "Unable to load your Pantry.";
    items.value = [];
  } finally {
    referenceLoading.value = false;
  }
}

function parseNonNegNumber(raw: string, label: string): number | null {
  const t = raw.trim();
  if (t === "") {
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
    createFoodError.value = "API base URL is not configured.";
    return;
  }

  const name = createFoodName.value.trim();
  if (name === "") {
    createFoodError.value = "Name is required.";
    return;
  }
  const baseValRaw = createFoodBaseValue.value.trim();
  if (baseValRaw === "") {
    createFoodError.value = "Base amount is required.";
    return;
  }
  const baseVal = Number(baseValRaw);
  if (!Number.isFinite(baseVal) || baseVal <= 0) {
    createFoodError.value = "Base amount must be a positive number.";
    return;
  }

  const cal = parseNonNegNumber(createFoodCalories.value, "Calories");
  if (cal === null) {
    return;
  }
  const protein = parseNonNegNumber(createFoodProtein.value, "Protein");
  if (protein === null) {
    return;
  }
  const fat = parseNonNegNumber(createFoodFat.value, "Fat");
  if (fat === null) {
    return;
  }
  const carbs = parseNonNegNumber(createFoodCarbs.value, "Carbohydrates");
  if (carbs === null) {
    return;
  }

  if (createFoodIconKey.value === "") {
    createFoodError.value = "Choose an icon.";
    return;
  }

  const brandTrim = createFoodBrand.value.trim();
  createFoodSubmitting.value = true;
  try {
    await $fetch(`${normalizeHealthyApiBaseUrl(base)}/pantry/items/food`, {
      method: "POST",
      credentials: "include",
      body: {
        name,
        ...(brandTrim === "" ? {} : { brand: brandTrim }),
        iconKey: createFoodIconKey.value,
        baseAmount: { value: baseVal, unit: createFoodBaseUnit.value },
        nutrients: {
          calories: cal,
          protein,
          fat,
          carbohydrates: carbs,
        },
      },
    });
    createFoodName.value = "";
    createFoodBrand.value = "";
    createFoodBaseValue.value = "";
    createFoodCalories.value = "";
    createFoodProtein.value = "";
    createFoodFat.value = "";
    createFoodCarbs.value = "";
    await fetchItemsPayload(base);
    itemsError.value = null;
  } catch (err: unknown) {
    const data =
      err !== null &&
      typeof err === "object" &&
      "data" in err &&
      err.data !== null &&
      typeof err.data === "object"
        ? (err.data as Record<string, unknown>)
        : undefined;
    if (
      data &&
      data["error"] === "invalid_input" &&
      typeof data["message"] === "string"
    ) {
      createFoodError.value = data["message"] as string;
    } else {
      createFoodError.value = "Unable to save food.";
    }
  } finally {
    createFoodSubmitting.value = false;
  }
}

onMounted(async () => {
  await hydrate();
});

watch(tab, async () => {
  const resolved = apiBase.value;
  const base = resolved.ok ? resolved.baseUrl : null;
  if (!base || referenceError.value !== null || referenceLoading.value) {
    return;
  }
  await reloadItems(base);
});
</script>

<template>
  <section aria-labelledby="pantry-title" class="max-w-3xl space-y-6">
    <h1 id="pantry-title" class="text-2xl font-semibold tracking-tight">
      Pantry
    </h1>

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

    <Card
      v-if="tab === 'food' && !referenceLoading && referenceError === null"
      class="px-4"
      data-testid="pantry-create-food-card"
    >
      <CardHeader class="px-0 pt-0">
        <CardTitle class="text-base">Add a food</CardTitle>
        <CardDescription>
          Name, base amount (grams or ounces), icon, and required macros are saved to your private catalog.
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
              <Label for="pantry-food-brand">Brand <span class="text-muted-foreground">(optional)</span></Label>
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
      No {{ tab === "food" ? "foods" : "recipes" }} yet. Saved items appear here once you add them.
    </div>

    <ul
      v-else
      class="divide-y divide-border rounded-md border border-border"
      :aria-label="tab === 'food' ? 'Foods in your pantry' : 'Recipes in your pantry'"
    >
      <li
        v-for="it in items"
        :key="it.id"
        class="flex items-center gap-3 px-3 py-2 text-sm"
      >
        <span class="text-muted-foreground font-mono text-xs">{{ it.iconKey }}</span>
        <span class="font-medium">{{ it.name }}</span>
      </li>
    </ul>
  </section>
</template>
