<script setup lang="ts">
import { normalizeHealthyApiBaseUrl } from "@/utils/healthyApiClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const route = useRoute();
const router = useRouter();

const apiBase = useHealthyApiBaseUrl();

const loading = ref(true);
const loadError = ref<string | null>(null);

type FoodNutrients = {
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
};

type ServingRow =
  | { kind: "unit"; unit: string; grams: number }
  | { kind: "custom"; label: string; grams: number };

type FoodWire = {
  name: string;
  iconKey: string;
  brand?: string;
  baseAmountGrams: number;
  nutrients: FoodNutrients;
  servingOptions?: ServingRow[];
};

const food = ref<FoodWire | null>(null);
/** displayName map from `/pantry/reference` for predefined unit keys */
const unitDisplayNames = ref<Record<string, string>>({});

function scaleNutrients(n: FoodNutrients, baseG: number, targetG: number): FoodNutrients {
  const f = targetG / baseG;
  return {
    calories: n.calories * f,
    protein: n.protein * f,
    fat: n.fat * f,
    carbohydrates: n.carbohydrates * f,
  };
}

function servingLabel(meta: ServingRow): string {
  if (meta.kind === "custom") {
    return meta.label;
  }
  return unitDisplayNames.value[meta.unit] ?? meta.unit;
}

async function load() {
  loading.value = true;
  loadError.value = null;
  food.value = null;

  const resolved = apiBase.value;
  const base = resolved.ok ? resolved.baseUrl : null;
  const itemId = route.params["itemId"];
  const id =
    typeof itemId === "string"
      ? itemId
      : Array.isArray(itemId)
        ? itemId[0]
        : undefined;

  if (!base) {
    loading.value = false;
    loadError.value = "API base URL is not configured.";
    return;
  }

  if (id === undefined || id === "") {
    loading.value = false;
    loadError.value = "Missing food id.";
    return;
  }

  try {
    unitDisplayNames.value = {};
    try {
      const refRes = await $fetch<{
        servingUnits?: { key: string; displayName: string }[];
      }>(`${normalizeHealthyApiBaseUrl(base)}/pantry/reference`, {
        credentials: "include",
      });
      unitDisplayNames.value = Object.fromEntries(
        (refRes.servingUnits ?? []).map((u) => [u.key, u.displayName]),
      );
    } catch {
      unitDisplayNames.value = {};
    }

    const res = await $fetch<{
      item: { itemType: string; name: string; iconKey: string; metadata: Record<string, unknown> };
    }>(`${normalizeHealthyApiBaseUrl(base)}/pantry/items/${encodeURIComponent(id)}`, {
      credentials: "include",
    });

    const meta = res.item.metadata;
    if (
      res.item.itemType !== "food" ||
      meta["kind"] !== "food" ||
      typeof meta["baseAmountGrams"] !== "number" ||
      typeof meta["nutrients"] !== "object" ||
      meta["nutrients"] === null
    ) {
      loadError.value = "This pantry item is not a food.";
      return;
    }

    const nutrients = meta["nutrients"] as Record<string, unknown>;
    const fc = nutrients["calories"];
    const fp = nutrients["protein"];
    const ff = nutrients["fat"];
    const fcarb = nutrients["carbohydrates"];
    if (
      typeof fc !== "number" ||
      typeof fp !== "number" ||
      typeof ff !== "number" ||
      typeof fcarb !== "number"
    ) {
      loadError.value = "Food data is incomplete.";
      return;
    }

    const rawServing = meta["servingOptions"];
    let servingOptions: ServingRow[] | undefined;
    if (Array.isArray(rawServing)) {
      const parsed: ServingRow[] = [];
      for (const s of rawServing) {
        if (s !== null && typeof s === "object" && !Array.isArray(s)) {
          const o = s as Record<string, unknown>;
          if (
            o["kind"] === "unit" &&
            typeof o["unit"] === "string" &&
            typeof o["grams"] === "number"
          ) {
            parsed.push({ kind: "unit", unit: o["unit"], grams: o["grams"] });
          } else if (
            o["kind"] === "custom" &&
            typeof o["label"] === "string" &&
            typeof o["grams"] === "number"
          ) {
            parsed.push({ kind: "custom", label: o["label"], grams: o["grams"] });
          }
        }
      }
      if (parsed.length > 0) {
        servingOptions = parsed;
      }
    }

    const brand =
      typeof meta["brand"] === "string" && meta["brand"].trim() !== ""
        ? meta["brand"]
        : undefined;

    food.value = {
      name: res.item.name,
      iconKey: res.item.iconKey,
      brand,
      baseAmountGrams: meta["baseAmountGrams"] as number,
      nutrients: {
        calories: fc,
        protein: fp,
        fat: ff,
        carbohydrates: fcarb,
      },
      servingOptions,
    };
  } catch {
    loadError.value = "Unable to load this food.";
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.fullPath,
  () => {
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <section aria-labelledby="food-detail-title" class="mx-auto max-w-3xl space-y-6 p-6">
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="text-muted-foreground text-sm underline-offset-4 hover:underline"
        data-testid="pantry-food-detail-back"
        @click="router.push('/pantry')"
      >
        ← Pantry
      </button>
    </div>

    <div v-if="loading" class="text-muted-foreground text-sm">
      Loading…
    </div>
    <div
      v-else-if="loadError"
      class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      role="alert"
      data-testid="pantry-food-detail-error"
    >
      {{ loadError }}
    </div>

    <div v-else-if="food" class="space-y-6">
      <div>
        <h1 id="food-detail-title" class="text-2xl font-semibold tracking-tight">
          {{ food.name }}
        </h1>
        <p v-if="food.brand" class="text-muted-foreground mt-1 text-sm">
          {{ food.brand }}
        </p>
        <p class="text-muted-foreground mt-1 font-mono text-xs">
          {{ food.iconKey }}
        </p>
      </div>

      <Card data-testid="pantry-food-detail-base-card">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Per base amount</CardTitle>
          <CardDescription>
            Nutrients are stored relative to {{ food.baseAmountGrams }} g.
          </CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2 text-sm sm:grid-cols-2">
          <div><span class="text-muted-foreground">Calories</span>: {{ food.nutrients.calories }}</div>
          <div><span class="text-muted-foreground">Protein</span>: {{ food.nutrients.protein }} g</div>
          <div><span class="text-muted-foreground">Fat</span>: {{ food.nutrients.fat }} g</div>
          <div><span class="text-muted-foreground">Carbs</span>: {{ food.nutrients.carbohydrates }} g</div>
        </CardContent>
      </Card>

      <Card v-if="food.servingOptions && food.servingOptions.length > 0" data-testid="pantry-food-detail-servings-card">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Serving options</CardTitle>
          <CardDescription>Amounts scaled from the base macros above.</CardDescription>
        </CardHeader>
        <CardContent class="overflow-x-auto">
          <table class="w-full border-collapse text-left text-sm">
            <thead>
              <tr class="border-border border-b">
                <th class="py-2 pr-2 font-medium">Serving</th>
                <th class="py-2 pr-2 font-medium">Mass (g)</th>
                <th class="py-2 pr-2 font-medium">Cal</th>
                <th class="py-2 pr-2 font-medium">Prot</th>
                <th class="py-2 pr-2 font-medium">Fat</th>
                <th class="py-2 font-medium">Carb</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(s, i) in food.servingOptions"
                :key="i"
                class="border-border/80 border-b last:border-none"
              >
                <td class="py-2 pr-2">
                  {{ servingLabel(s) }}
                </td>
                <td class="py-2 pr-2">{{ s.grams }}</td>
                <td class="py-2 pr-2 tabular-nums">
                  {{
                    scaleNutrients(food.nutrients, food.baseAmountGrams, s.grams).calories.toFixed(1)
                  }}
                </td>
                <td class="py-2 pr-2 tabular-nums">
                  {{
                    scaleNutrients(food.nutrients, food.baseAmountGrams, s.grams).protein.toFixed(2)
                  }}
                </td>
                <td class="py-2 pr-2 tabular-nums">
                  {{ scaleNutrients(food.nutrients, food.baseAmountGrams, s.grams).fat.toFixed(2) }}
                </td>
                <td class="py-2 tabular-nums">
                  {{
                    scaleNutrients(food.nutrients, food.baseAmountGrams, s.grams).carbohydrates.toFixed(
                      2,
                    )
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p
        v-else
        class="text-muted-foreground text-sm"
        data-testid="pantry-food-detail-no-servings"
      >
        No extra serving options; macros are expressed only per the base amount above.
      </p>
    </div>
  </section>
</template>
