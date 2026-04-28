import type { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';

export async function registerSensible(app: FastifyInstance) {
  await app.register(sensible);
}
