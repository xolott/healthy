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

type IngredientRow = {
  ingredientKind: string;
  displayName: string;
  quantity: number;
  servingOption: Record<string, unknown>;
};

const recipe = ref<{
  name: string;
  iconKey: string;
  servings: number;
  servingLabel: string;
  nutrients: FoodNutrients;
  nutrientsPerServing: FoodNutrients;
  ingredients: IngredientRow[];
} | null>(null);

function servingOptionLabel(o: Record<string, unknown>): string {
  const k = o["kind"];
  if (k === "base") {
    return "base amount";
  }
  if (k === "unit" && typeof o["unit"] === "string") {
    return o["unit"];
  }
  if (k === "custom" && typeof o["label"] === "string") {
    return o["label"];
  }
  return String(k ?? "");
}

async function load() {
  loading.value = true;
  loadError.value = null;
  recipe.value = null;

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
    loadError.value = "Missing recipe id.";
    return;
  }

  try {
    const res = await $fetch<{
      item: {
        itemType: string;
        name: string;
        iconKey: string;
        metadata: Record<string, unknown>;
        ingredients?: {
          ingredientKind: string;
          pantryItemId: string;
          displayName: string;
          quantity: number;
          servingOption: Record<string, unknown>;
        }[];
      };
    }>(`${normalizeHealthyApiBaseUrl(base)}/pantry/items/${encodeURIComponent(id)}`, {
      credentials: "include",
    });

    const meta = res.item.metadata;
    if (
      res.item.itemType !== "recipe" ||
      meta["kind"] !== "recipe" ||
      typeof meta["servings"] !== "number" ||
      typeof meta["servingLabel"] !== "string" ||
      typeof meta["nutrients"] !== "object" ||
      meta["nutrients"] === null ||
      typeof meta["nutrientsPerServing"] !== "object" ||
      meta["nutrientsPerServing"] === null
    ) {
      loadError.value = "This pantry item is not a recipe.";
      return;
    }

    const n = meta["nutrients"] as Record<string, unknown>;
    const nps = meta["nutrientsPerServing"] as Record<string, unknown>;
    const nums = (o: Record<string, unknown>): FoodNutrients | null => {
      const cal = o["calories"];
      const p = o["protein"];
      const f = o["fat"];
      const c = o["carbohydrates"];
      if (
        typeof cal !== "number" ||
        typeof p !== "number" ||
        typeof f !== "number" ||
        typeof c !== "number"
      ) {
        return null;
      }
      return { calories: cal, protein: p, fat: f, carbohydrates: c };
    };
    const nutrients = nums(n);
    const nutrientsPerServing = nums(nps);
    if (nutrients === null || nutrientsPerServing === null) {
      loadError.value = "Recipe data is incomplete.";
      return;
    }

    const rawIng = res.item.ingredients ?? [];
    const ingredients: IngredientRow[] = rawIng.map((r) => ({
      ingredientKind:
        typeof r.ingredientKind === "string" ? r.ingredientKind : "food",
      displayName:
        typeof r.displayName === "string"
          ? r.displayName
          : typeof (r as { foodName?: string }).foodName === "string"
            ? (r as { foodName: string }).foodName
            : "",
      quantity: r.quantity,
      servingOption:
        r.servingOption !== null && typeof r.servingOption === "object"
          ? (r.servingOption as Record<string, unknown>)
          : {},
    }));

    recipe.value = {
      name: res.item.name,
      iconKey: res.item.iconKey,
      servings: meta["servings"] as number,
      servingLabel: meta["servingLabel"] as string,
      nutrients,
      nutrientsPerServing,
      ingredients,
    };
  } catch {
    loadError.value = "Unable to load this recipe.";
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
  <section aria-labelledby="recipe-detail-title" class="mx-auto max-w-3xl space-y-6 p-6">
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="text-muted-foreground text-sm underline-offset-4 hover:underline"
        data-testid="pantry-recipe-detail-back"
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
      data-testid="pantry-recipe-detail-error"
    >
      {{ loadError }}
    </div>

    <div v-else-if="recipe" class="space-y-6">
      <div>
        <h1 id="recipe-detail-title" class="text-2xl font-semibold tracking-tight">
          {{ recipe.name }}
        </h1>
        <p class="text-muted-foreground mt-1 font-mono text-xs">
          {{ recipe.iconKey }}
        </p>
        <p class="text-muted-foreground mt-1 text-sm">
          Makes {{ recipe.servings }} {{ recipe.servingLabel }}{{ recipe.servings === 1 ? "" : "s" }}
        </p>
      </div>

      <Card data-testid="pantry-recipe-detail-totals">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Nutrients</CardTitle>
          <CardDescription> Totals are summed from ingredients; per-{{ recipe.servingLabel }} divides by yield. </CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p class="text-muted-foreground mb-1 text-xs font-medium">Full recipe</p>
            <div class="grid gap-1">
              <div><span class="text-muted-foreground">Calories</span>: {{ recipe.nutrients.calories.toFixed(0) }}</div>
              <div><span class="text-muted-foreground">Protein</span>: {{ recipe.nutrients.protein.toFixed(1) }} g</div>
              <div><span class="text-muted-foreground">Fat</span>: {{ recipe.nutrients.fat.toFixed(1) }} g</div>
              <div><span class="text-muted-foreground">Carbs</span>: {{ recipe.nutrients.carbohydrates.toFixed(1) }} g</div>
            </div>
          </div>
          <div>
            <p class="text-muted-foreground mb-1 text-xs font-medium">Per {{ recipe.servingLabel }}</p>
            <div class="grid gap-1">
              <div>
                <span class="text-muted-foreground">Calories</span>:
                {{ recipe.nutrientsPerServing.calories.toFixed(0) }}
              </div>
              <div>
                <span class="text-muted-foreground">Protein</span>:
                {{ recipe.nutrientsPerServing.protein.toFixed(1) }} g
              </div>
              <div>
                <span class="text-muted-foreground">Fat</span>:
                {{ recipe.nutrientsPerServing.fat.toFixed(1) }} g
              </div>
              <div>
                <span class="text-muted-foreground">Carbs</span>:
                {{ recipe.nutrientsPerServing.carbohydrates.toFixed(1) }} g
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card v-if="recipe.ingredients.length > 0" data-testid="pantry-recipe-detail-ingredients">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Ingredients</CardTitle>
        </CardHeader>
        <CardContent class="text-sm">
          <ul class="divide-y divide-border">
            <li
              v-for="(ing, i) in recipe.ingredients"
              :key="i"
              class="flex flex-wrap justify-between gap-2 py-2"
            >
              <span class="flex flex-wrap items-baseline gap-2 font-medium">
                {{ ing.displayName }}
                <span
                  v-if="ing.ingredientKind === 'recipe'"
                  class="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs font-normal"
                  >Nested recipe</span>
              </span>
              <span class="text-muted-foreground tabular-nums">
                × {{ ing.quantity }}
                <span class="text-xs">({{ servingOptionLabel(ing.servingOption) }})</span>
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
