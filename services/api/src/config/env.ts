import type { FastifyInstance } from 'fastify';
import envPlugin from '@fastify/env';

import { registerDatabaseAdapter } from './database-adapter.js';
import { assertValidOptionalDatabaseUrl } from './validate-database-url.js';

const schema = {
  type: 'object',
  properties: {
    NODE_ENV: { type: 'string', default: 'development' },
    HOST: { type: 'string', default: '0.0.0.0' },
    PORT: { type: 'string', default: '3001' },
    LOG_LEVEL: { type: 'string', default: 'info' },
    CORS_ORIGIN: { type: 'string', default: '*' },
    DATABASE_URL: { type: 'string' },
  },
};

export async function registerEnv(app: FastifyInstance) {
  await app.register(envPlugin, {
    schema,
    dotenv: true,
  });
  assertValidOptionalDatabaseUrl(app.config.DATABASE_URL);
  registerDatabaseAdapter(app);
}
