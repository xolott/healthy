import type { RequestScope } from '../../src/request-scope/index.js';

/** Satisfies RequestScope.pantry where routes under test do not call Pantry surfaces. */
export function unusedPantryCapability(): RequestScope['pantry'] {
  return {
    async listItemsForOwner() {
      return { kind: 'ok', items: [] };
    },
    async getItemForOwner() {
      return { kind: 'not_found' };
    },
    async getReferenceCatalog() {
      return {
        kind: 'ok',
        nutrients: [],
        iconKeys: [],
        servingUnits: [],
      };
    },
    async createFoodForOwner() {
      return {
        kind: 'invalid_input',
        field: 'body',
        message: 'Pantry create food is not exercised in this test.',
      };
    },
    async createRecipeForOwner() {
      return {
        kind: 'invalid_input',
        field: 'body',
        message: 'Pantry create recipe is not exercised in this test.',
      };
    },
  };
}
