import { describe, expect, it } from "vitest";

import {
  pantryFoodCaloriesFromList,
  pantryItemMatchesActiveTabSearch,
  pantryRecipeCaloriesPerServingFromList,
  type PantryWireItem,
} from "../../app/utils/pantryCatalog";

function foodItem(partial: Partial<PantryWireItem> & Pick<PantryWireItem, "id" | "name">): PantryWireItem {
  return {
    iconKey: "food_apple",
    itemType: "food",
    metadata: {
      kind: "food",
      nutrients: { calories: 100, protein: 2, fat: 3, carbohydrates: 4 },
    },
    ...partial,
  };
}

function recipeItem(partial: Partial<PantryWireItem> & Pick<PantryWireItem, "id" | "name">): PantryWireItem {
  return {
    iconKey: "recipe_pot",
    itemType: "recipe",
    metadata: {
      kind: "recipe",
      nutrientsPerServing: { calories: 212, protein: 10, fat: 8, carbohydrates: 20 },
    },
    ...partial,
  };
}

describe("pantryFoodCaloriesFromList", () => {
  it("reads nutrients.calories for food rows", () => {
    expect(pantryFoodCaloriesFromList(foodItem({ id: "1", name: "Oats" }))).toBe(100);
  });

  it("returns undefined for recipe rows", () => {
    expect(
      pantryFoodCaloriesFromList(recipeItem({ id: "1", name: "Soup" })),
    ).toBeUndefined();
  });

  it("returns undefined when metadata is missing calories shape", () => {
    expect(
      pantryFoodCaloriesFromList({
        id: "1",
        name: "X",
        iconKey: "k",
        itemType: "food",
        metadata: {},
      }),
    ).toBeUndefined();
  });
});

describe("pantryRecipeCaloriesPerServingFromList", () => {
  it("reads nutrientsPerServing.calories for recipe rows", () => {
    expect(pantryRecipeCaloriesPerServingFromList(recipeItem({ id: "1", name: "Chili" }))).toBe(212);
  });

  it("returns undefined for food rows", () => {
    expect(pantryRecipeCaloriesPerServingFromList(foodItem({ id: "1", name: "Egg" }))).toBeUndefined();
  });
});

describe("pantryItemMatchesActiveTabSearch (Food vs Recipe tab parity)", () => {
  const oats = foodItem({
    id: "f1",
    name: "Morning Oats",
    metadata: {
      kind: "food",
      brand: "Test Mill",
      nutrients: { calories: 150, protein: 5, fat: 2, carbohydrates: 25 },
    },
  });

  const chili = recipeItem({
    id: "r1",
    name: "Weeknight Chili",
    metadata: {
      kind: "recipe",
      nutrientsPerServing: { calories: 300, protein: 20, fat: 12, carbohydrates: 18 },
      brand: "Should Not Match On Recipe Tab",
    },
  });

  it("matches food by name substring", () => {
    expect(pantryItemMatchesActiveTabSearch(oats, "oat", "food")).toBe(true);
  });

  it("matches food by brand substring when Food tab is active", () => {
    expect(pantryItemMatchesActiveTabSearch(oats, "mill", "food")).toBe(true);
  });

  it("does not match food when query misses name and brand", () => {
    expect(pantryItemMatchesActiveTabSearch(oats, "zzz", "food")).toBe(false);
  });

  it("matches recipe by name substring when Recipe tab is active", () => {
    expect(pantryItemMatchesActiveTabSearch(chili, "chili", "recipe")).toBe(true);
  });

  it("does not match recipe by metadata brand when Recipe tab is active (parity with Foods name+brand vs Recipes name-only)", () => {
    expect(pantryItemMatchesActiveTabSearch(chili, "Should Not", "recipe")).toBe(false);
    expect(pantryItemMatchesActiveTabSearch(chili, "mill", "recipe")).toBe(false);
  });

  it("empty query matches any row", () => {
    expect(pantryItemMatchesActiveTabSearch(oats, "", "food")).toBe(true);
    expect(pantryItemMatchesActiveTabSearch(chili, "  ", "recipe")).toBe(true);
  });
});
