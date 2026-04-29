/**
 * Meals primary destinations — keep labels identical to mobile (product parity).
 */
export const mealsNavDestinations = [
  { path: "/home", label: "Home", testid: "meals-nav-home" },
  { path: "/food-log", label: "Food Log", testid: "meals-nav-food-log" },
  { path: "/pantry", label: "Pantry", testid: "meals-nav-pantry" },
  { path: "/progress", label: "Progress", testid: "meals-nav-progress" },
] as const;

export type MealsNavDestination = (typeof mealsNavDestinations)[number];
