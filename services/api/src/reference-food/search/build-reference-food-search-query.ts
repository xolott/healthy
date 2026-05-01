/**
 * Elasticsearch query for weighted name and brand matching: phrase-prefix for
 * leading-token behavior, plus light fuzziness via `match`.
 */
export function buildReferenceFoodSearchQuery(searchText: string): Record<string, unknown> {
  return {
    bool: {
      should: [
        {
          match_phrase_prefix: {
            displayName: { query: searchText, boost: 4 },
          },
        },
        {
          match: {
            displayName: {
              query: searchText,
              fuzziness: 'AUTO',
              boost: 2,
            },
          },
        },
        {
          match_phrase_prefix: {
            brand: { query: searchText, boost: 3 },
          },
        },
        {
          match: {
            brand: {
              query: searchText,
              fuzziness: 'AUTO',
              boost: 1.5,
            },
          },
        },
      ],
      minimum_should_match: 1,
    },
  };
}
