import 'fastify';

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
    };
  }
}
