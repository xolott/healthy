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
      };
    },
  };
}
