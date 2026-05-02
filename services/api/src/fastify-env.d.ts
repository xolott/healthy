import 'fastify';

import type { DatabaseAdapter } from '@healthy/db';

/**
 * Scaffold typing for `@fastify/env`-populated Fastify.config.
 *
 * Keep keys aligned with `src/config/env.ts` schema.properties.
 */
declare module 'fastify' {
  interface FastifyInstance {
    config: {
      NODE_ENV: string;
      HOST: string;
      PORT: string;
      LOG_LEVEL: string;
      CORS_ORIGIN: string;
      DATABASE_URL?: string;
      ELASTICSEARCH_URL?: string;
      ELASTICSEARCH_API_KEY?: string;
      ELASTICSEARCH_USERNAME?: string;
      ELASTICSEARCH_PASSWORD?: string;
    };
    /** Set by `registerDatabaseAdapter` after env load; `null` when persistence is not configured. */
    databaseAdapter: DatabaseAdapter | null;
  }
}
