import type {
  FirstOwnerSetupResult,
  LogoutResult,
  OwnerLoginResult,
  ResolveCurrentSessionResult,
} from '../auth/auth-use-cases.js';

/**
 * Request Scope exposes infrastructure-backed capabilities without route-shaped HTTP outcomes.
 * Status reads map persistence configuration and availability to a closed outcome union;
 * routes translate these to HTTP.
 */
export type PublicSetupStatusOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | { kind: 'ok'; isFirstOwnerSetupRequired: boolean };

export type RequestScopeStatusCapability = {
  isFirstOwnerSetupRequired(): Promise<PublicSetupStatusOutcome>;
};

/**
 * Current-session resolution: persistence gate plus closed session outcomes from auth use cases.
 */
export type PublicCurrentSessionOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | ResolveCurrentSessionResult;

export type RequestScopeCurrentSessionCapability = {
  resolveFromRawToken(rawToken: string): Promise<PublicCurrentSessionOutcome>;
};

/**
 * Logout: persistence gate plus closed logout outcomes from auth use cases.
 * Callers pass the raw token from transport; an absent token is treated as idempotent skip without persistence.
 */
export type PublicLogoutOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | LogoutResult;

export type RequestScopeLogoutCapability = {
  logoutWithRawToken(rawToken: string | undefined): Promise<PublicLogoutOutcome>;
};

/**
 * Owner login: persistence gate plus closed login outcomes from auth use cases.
 */
export type PublicOwnerLoginOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | OwnerLoginResult;

export type RequestScopeOwnerLoginCapability = {
  loginWithEmailPassword(
    rawEmail: string,
    rawPassword: string,
    ctx: { ip: string | null; userAgent: string | null },
  ): Promise<PublicOwnerLoginOutcome>;
};

/**
 * First-owner setup: persistence gate plus closed outcomes from auth use cases.
 * When persistence is not configured, payload validation runs before `persistence_not_configured`.
 */
export type PublicFirstOwnerSetupOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | FirstOwnerSetupResult;

export type RequestScopeFirstOwnerSetupCapability = {
  setupFirstOwner(
    rawDisplayName: string,
    rawEmail: string,
    rawPassword: string,
    ctx: { setCookie: boolean; ip: string | null; userAgent: string | null },
  ): Promise<PublicFirstOwnerSetupOutcome>;
};

/**
 * Authenticated pantry catalog payloads (excluding transport auth).
 */

export type PantryItemWire = {
  id: string;
  itemType: 'food' | 'recipe';
  name: string;
  iconKey: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type RecipeIngredientWire = {
  ingredientKind: 'food' | 'recipe';
  pantryItemId: string;
  displayName: string;
  quantity: number;
  servingOption:
    | { kind: 'base' }
    | { kind: 'unit'; unit: string }
    | { kind: 'custom'; label: string };
};

export type PantryItemDetailWire = PantryItemWire & {
  ingredients?: RecipeIngredientWire[];
};

export type NutrientCatalogEntry = {
  key: string;
  displayName: string;
  canonicalUnit: string;
};

export type PublicPantryItemsListOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | { kind: 'ok'; items: PantryItemWire[] };

export type PublicPantryItemDetailOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | { kind: 'not_found' }
  | { kind: 'ok'; item: PantryItemDetailWire };

export type ServingUnitCatalogEntry = {
  key: string;
  displayName: string;
};

export type PublicPantryReferenceOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | {
      kind: 'ok';
      nutrients: NutrientCatalogEntry[];
      iconKeys: readonly string[];
      servingUnits: ServingUnitCatalogEntry[];
    };

export type PublicCreateFoodOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | { kind: 'invalid_input'; field: string; message: string }
  | { kind: 'ok'; item: PantryItemWire };

export type PublicCreateRecipeOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | { kind: 'invalid_input'; field: string; message: string }
  | { kind: 'ok'; item: PantryItemDetailWire };

export type RequestScopePantryCapability = {
  listItemsForOwner(ownerUserId: string, itemType: 'food' | 'recipe'): Promise<PublicPantryItemsListOutcome>;
  getItemForOwner(ownerUserId: string, itemId: string): Promise<PublicPantryItemDetailOutcome>;
  getReferenceCatalog(): Promise<PublicPantryReferenceOutcome>;
  createFoodForOwner(ownerUserId: string, rawBody: unknown): Promise<PublicCreateFoodOutcome>;
  createRecipeForOwner(ownerUserId: string, rawBody: unknown): Promise<PublicCreateRecipeOutcome>;
};

/** One logged consumption row as returned by Food Log HTTP (snapshot fields). */
export type FoodLogEntryWire = {
  id: string;
  pantryItemId: string;
  displayName: string;
  calories: number;
  proteinGrams: number;
  fatGrams: number;
  carbohydratesGrams: number;
  consumedDate: string;
};

export type PublicFoodLogListOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | { kind: 'ok'; entries: FoodLogEntryWire[] };

export type PublicFoodLogBatchCreateOutcome =
  | { kind: 'persistence_not_configured' }
  | { kind: 'persistence_unavailable' }
  | { kind: 'invalid_input'; field: string; message: string }
  | { kind: 'ok'; entries: FoodLogEntryWire[] };

export type RequestScopeFoodLogCapability = {
  listEntriesForOwnerOnLocalDate(
    ownerUserId: string,
    consumedDate: string,
  ): Promise<PublicFoodLogListOutcome>;
  createEntriesBatchForOwner(ownerUserId: string, rawBody: unknown): Promise<PublicFoodLogBatchCreateOutcome>;
};

export type RequestScope = {
  status: RequestScopeStatusCapability;
  currentSession: RequestScopeCurrentSessionCapability;
  logout: RequestScopeLogoutCapability;
  ownerLogin: RequestScopeOwnerLoginCapability;
  firstOwnerSetup: RequestScopeFirstOwnerSetupCapability;

  pantry: RequestScopePantryCapability;
  foodLog: RequestScopeFoodLogCapability;
};
