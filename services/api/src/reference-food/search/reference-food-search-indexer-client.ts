import { errors, type Client } from '@elastic/elasticsearch';

export type ReferenceFoodSearchAliasAction =
  | { add: { index: string; alias: string } }
  | { remove: { index: string; alias: string } };

/**
 * Narrow port for reindexing so tests can fake Elasticsearch without a live cluster.
 */
export interface ReferenceFoodSearchIndexerClient {
  indicesCreate(params: {
    index: string;
    mappings: { properties: Record<string, unknown> };
  }): Promise<void>;

  /** Indices currently attached to the named alias; empty when the alias is missing. */
  indicesGetAlias(params: { name: string }): Promise<string[]>;

  bulk(params: {
    operations: unknown[];
    refresh?: boolean | 'wait_for' | true | false;
  }): Promise<{ errors: boolean }>;

  indicesUpdateAliases(params: { actions: ReferenceFoodSearchAliasAction[] }): Promise<void>;
}

export function adaptElasticsearchClient(client: Client): ReferenceFoodSearchIndexerClient {
  return {
    async indicesCreate({ index, mappings }) {
      await client.indices.create({
        index,
        mappings: mappings as NonNullable<
          Parameters<Client['indices']['create']>[0]['mappings']
        >,
      });
    },
    async indicesGetAlias({ name }) {
      try {
        const body = await client.indices.getAlias({ name });
        return Object.keys(body);
      } catch (err: unknown) {
        if (err instanceof errors.ResponseError && err.meta.statusCode === 404) {
          return [];
        }
        throw err;
      }
    },
    async bulk({ operations, refresh }) {
      const res = await client.bulk({ operations, refresh });
      return { errors: res.errors };
    },
    async indicesUpdateAliases({ actions }) {
      await client.indices.updateAliases({ actions });
    },
  };
}
