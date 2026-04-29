/**
 * Stable wire identifiers for Pantry Item icons — web and mobile map these to bundled assets.
 * Order matches the canonical API `/pantry/reference` list.
 */
export const PANTRY_ICON_KEYS = [
  'food_apple',
  'food_banana',
  'food_bread',
  'food_bowl',
  'food_carrot',
  'food_cheese',
  'food_egg',
  'food_fish',
  'food_meat',
  'food_milk',
  'food_nut',
  'food_pepper',
  'recipe_pot',
  'recipe_sauce',
  'recipe_soup',
] as const satisfies readonly string[];
