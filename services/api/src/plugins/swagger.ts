import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Healthy API',
        version: '0.0.0',
        description: 'Scaffold-only Fastify service for self-hosting. No persistence or authentication yet.',
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
}
