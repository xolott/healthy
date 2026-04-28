import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get(
    '/health',
    {
      schema: {
        summary: 'Liveness/readiness probe',
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async () => {
      return {
        status: 'ok',
        service: 'healthy-api',
        time: new Date().toISOString(),
      };
    },
  );
}
