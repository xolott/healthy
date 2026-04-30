import type { RequestScope } from '../../src/request-scope/index.js';

/** Satisfies RequestScope.foodLog where routes under test do not call Food Log surfaces. */
export function unusedFoodLogCapability(): RequestScope['foodLog'] {
  return {
    async listEntriesForOwnerOnLocalDate() {
      return { kind: 'ok', entries: [] };
    },
    async createEntriesBatchForOwner() {
      return {
        kind: 'invalid_input',
        field: 'body',
        message: 'Food Log batch create is not exercised in this test.',
      };
    },
  };
}
