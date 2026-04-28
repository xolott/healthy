import type { FastifyInstance } from 'fastify';
import envPlugin from '@fastify/env';

const schema = {
  type: 'object',
  properties: {
    NODE_ENV: { type: 'string', default: 'development' },
    HOST: { type: 'string', default: '0.0.0.0' },
    PORT: { type: 'string', default: '3001' },
    LOG_LEVEL: { type: 'string', default: 'info' },
    CORS_ORIGIN: { type: 'string', default: '*' },
  },
};

export async function registerEnv(app: FastifyInstance) {
  await app.register(envPlugin, {
    schema,
    dotenv: true,
  });
}
