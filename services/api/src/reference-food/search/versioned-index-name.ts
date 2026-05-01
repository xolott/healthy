/**
 * Concrete index name for one reindex build; safe for lowercase Elasticsearch index rules.
 */
export function newVersionedReferenceFoodSearchIndexName(date = new Date()): string {
  const iso = date.toISOString();
  const compact = iso
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/i, 'z')
    .toLowerCase();
  return `reference_foods_search_v_${compact}`;
}
