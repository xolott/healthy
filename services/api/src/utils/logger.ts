import type { FastifyBaseLogger } from 'fastify';

export function summarizeLogger(logger: FastifyBaseLogger): void {
  logger.info('Healthy API scaffold ready (no persistence or authentication yet)');
}
