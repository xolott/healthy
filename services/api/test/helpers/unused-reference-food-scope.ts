import type { RequestScope } from '../../src/request-scope/index.js';

/** Satisfies RequestScope.referenceFood where routes under test do not call it. */
export function unusedReferenceFoodCapability(): RequestScope['referenceFood'] {
  return {
    async searchActive() {
      return {
        kind: 'invalid_input',
        field: 'q',
        message: 'Reference Food search is not exercised in this test.',
      };
    },
    async getActiveDetail() {
      return { kind: 'not_found' };
    },
  };
}
