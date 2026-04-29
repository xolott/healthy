/** Pantry list row from GET `/pantry/items` (food or recipe). */
export type PantryWireItem = {
  id: string;
  name: string;
  iconKey: string;
  itemType: string;
  metadata?: Record<string, unknown>;
};

export function pantryFoodCaloriesFromList(it: PantryWireItem): number | undefined {
  if (it.itemType !== "food") {
    return undefined;
  }
  const meta = it.metadata;
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
    return undefined;
  }
  const nutrients = meta["nutrients"];
  if (nutrients === null || typeof nutrients !== "object" || Array.isArray(nutrients)) {
    return undefined;
  }
  const n = nutrients as Record<string, unknown>;
  const raw = n["calories"];
  return typeof raw === "number" ? raw : undefined;
}

export function pantryRecipeCaloriesPerServingFromList(it: PantryWireItem): number | undefined {
  if (it.itemType !== "recipe") {
    return undefined;
  }
  const meta = it.metadata;
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
    return undefined;
  }
  const nps = meta["nutrientsPerServing"];
  if (nps === null || typeof nps !== "object" || Array.isArray(nps)) {
    return undefined;
  }
  const n = nps as Record<string, unknown>;
  const raw = n["calories"];
  return typeof raw === "number" ? raw : undefined;
}

/** Client-side filter: matches Foods tab (name + brand) vs Recipes tab (name only), mirroring mobile `pantrySearchMatches`. */
export function pantryItemMatchesActiveTabSearch(
  it: PantryWireItem,
  query: string,
  activeTab: "food" | "recipe",
): boolean {
  const lower = query.trim().toLowerCase();
  if (lower === "") {
    return true;
  }
  if (it.name.toLowerCase().includes(lower)) {
    return true;
  }
  if (activeTab === "food") {
    const meta = it.metadata;
    if (meta !== null && typeof meta === "object" && !Array.isArray(meta)) {
      const b = meta["brand"];
      if (typeof b === "string" && b.trim() !== "" && b.toLowerCase().includes(lower)) {
        return true;
      }
    }
  }
  return false;
}
