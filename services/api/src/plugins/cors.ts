import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export async function registerCors(app: FastifyInstance) {
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });
}
