import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';
import envPlugin from '@fastify/env';

import { registerDatabaseAdapter } from './database-adapter.js';
import { assertValidOptionalDatabaseUrl } from './validate-database-url.js';

/** `services/api/.env` regardless of `process.cwd()` (Turbo, IDE runners, etc.). */
const apiPackageEnvPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env');

const schema = {
  type: 'object',
  properties: {
    NODE_ENV: { type: 'string', default: 'development' },
    HOST: { type: 'string', default: '0.0.0.0' },
    PORT: { type: 'string', default: '3001' },
    LOG_LEVEL: { type: 'string', default: 'info' },
    CORS_ORIGIN: { type: 'string', default: '*' },
    DATABASE_URL: { type: 'string' },
    ELASTICSEARCH_URL: { type: 'string' },
    ELASTICSEARCH_API_KEY: { type: 'string' },
    ELASTICSEARCH_USERNAME: { type: 'string' },
    ELASTICSEARCH_PASSWORD: { type: 'string' },
  },
};

/**
 * env-schema validates into `app.config` only; it does not mutate `process.env`.
 * Elasticsearch helpers read `process.env`, so copy configured values after load.
 */
function syncElasticsearchConfigToProcessEnv(config: FastifyInstance['config']): void {
  const keys = [
    'ELASTICSEARCH_URL',
    'ELASTICSEARCH_API_KEY',
    'ELASTICSEARCH_USERNAME',
    'ELASTICSEARCH_PASSWORD',
  ] as const;
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'string' && value.length > 0) {
      process.env[key] = value;
    }
  }
}

export async function registerEnv(app: FastifyInstance) {
  await app.register(envPlugin, {
    schema,
    dotenv: { path: apiPackageEnvPath },
  });
  syncElasticsearchConfigToProcessEnv(app.config);
  assertValidOptionalDatabaseUrl(app.config.DATABASE_URL);
  registerDatabaseAdapter(app);
}
