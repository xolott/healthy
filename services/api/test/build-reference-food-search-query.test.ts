import { describe, expect, it } from 'vitest';

import { buildReferenceFoodSearchQuery } from '../src/reference-food/search/build-reference-food-search-query.js';

describe('buildReferenceFoodSearchQuery', () => {
  it('uses bool.should with phrase_prefix and fuzzy matches on displayName and brand', () => {
    const q = buildReferenceFoodSearchQuery('oat milk');
    expect(q).toMatchObject({
      bool: {
        minimum_should_match: 1,
      },
    });
    const bool = q.bool as { should: unknown[] };
    expect(bool.should).toHaveLength(4);
    expect(bool.should[0]).toEqual({
      match_phrase_prefix: {
        displayName: { query: 'oat milk', boost: 4 },
      },
    });
    expect(bool.should[1]).toEqual({
      match: {
        displayName: {
          query: 'oat milk',
          fuzziness: 'AUTO',
          boost: 2,
        },
      },
    });
    expect(bool.should[2]).toEqual({
      match_phrase_prefix: {
        brand: { query: 'oat milk', boost: 3 },
      },
    });
    expect(bool.should[3]).toEqual({
      match: {
        brand: {
          query: 'oat milk',
          fuzziness: 'AUTO',
          boost: 1.5,
        },
      },
    });
  });
});
