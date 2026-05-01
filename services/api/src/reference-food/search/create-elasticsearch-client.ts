import { Client } from '@elastic/elasticsearch';

export type ElasticsearchEnvAuth =
  | { apiKey: string }
  | { username: string; password: string }
  | undefined;

/**
 * Reads URL plus optional API key or basic auth for the Elasticsearch client.
 */
export function readElasticsearchAuthFromEnv(): ElasticsearchEnvAuth {
  const apiKey = process.env.ELASTICSEARCH_API_KEY;
  if (apiKey !== undefined && apiKey.length > 0) {
    return { apiKey };
  }
  const username = process.env.ELASTICSEARCH_USERNAME;
  const password = process.env.ELASTICSEARCH_PASSWORD;
  if (
    username !== undefined &&
    username.length > 0 &&
    password !== undefined &&
    password.length > 0
  ) {
    return { username, password };
  }
  return undefined;
}

export function createElasticsearchClientFromEnv(): Client {
  const node = process.env.ELASTICSEARCH_URL;
  if (node === undefined || node.length === 0) {
    throw new Error('ELASTICSEARCH_URL is required.');
  }
  const auth = readElasticsearchAuthFromEnv();
  return new Client({
    node,
    ...(auth !== undefined ? { auth } : {}),
  });
}
