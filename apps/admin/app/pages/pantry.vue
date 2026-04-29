<script setup lang="ts">
import { normalizeHealthyApiBaseUrl } from "@/utils/healthyApiClient";

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
const iconKeysCount = ref<number | null>(null);

const items = ref<PantryWireItem[]>([]);
const itemsError = ref<string | null>(null);
const referenceLoading = ref(true);
const itemsLoading = ref(false);

async function loadReference(base: string): Promise<boolean> {
  referenceError.value = null;
  try {
    const res = await $fetch<{ nutrients: { key: string }[]; iconKeys: string[] }>(
      `${normalizeHealthyApiBaseUrl(base)}/pantry/reference`,
      { credentials: "include" },
    );
    nutrientsCount.value = res.nutrients.length;
    iconKeysCount.value = res.iconKeys.length;
    return true;
  } catch {
    referenceError.value = "Unable to load nutrient catalog.";
    nutrientsCount.value = null;
    iconKeysCount.value = null;
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
      {{ iconKeysCount }}
    </div>

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
