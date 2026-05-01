import type { Client } from '@elastic/elasticsearch';

import { buildReferenceFoodSearchQuery } from './build-reference-food-search-query.js';

export type ReferenceFoodSearchHitSource = {
  referenceFoodId?: string;
};

/**
 * Runs search against the Reference Food alias and returns hit ids in score order.
 */
export async function searchReferenceFoodIdsOrdered(
  client: Client,
  indexAlias: string,
  q: string,
  size: number,
): Promise<string[]> {
  const result = await client.search<ReferenceFoodSearchHitSource>({
    index: indexAlias,
    size,
    _source: ['referenceFoodId'],
    query: buildReferenceFoodSearchQuery(q),
  });

  const ids: string[] = [];
  for (const hit of result.hits.hits) {
    const id = hit._source?.referenceFoodId;
    if (typeof id === 'string' && id.length > 0) {
      ids.push(id);
    }
  }
  return ids;
}
