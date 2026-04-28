import type { FastifyInstance } from 'fastify';

import { createUserRepository, withDisposableDatabase } from '@healthy/db';

import { getApiSemver } from '../api-version.js';

const statusResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['api', 'setupRequired'],
  properties: {
    api: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'version'],
      properties: {
        name: { type: 'string', const: 'healthy-api' },
        version: { type: 'string' },
      },
    },
    setupRequired: { type: 'boolean' },
  },
} as const;

export type StatusRouteDeps = {
  hasActiveOwner(): Promise<boolean>;
};

async function resolveHasActiveOwner(
  app: FastifyInstance,
  deps: StatusRouteDeps | undefined,
): Promise<boolean> {
  if (deps !== undefined) {
    return deps.hasActiveOwner();
  }
  const url = app.config.DATABASE_URL?.trim();
  if (url === undefined || url === '') {
    throw app.httpErrors.serviceUnavailable('DATABASE_NOT_CONFIGURED');
  }
  try {
    return await withDisposableDatabase(url, async (db) => {
      const repo = createUserRepository(db);
      return repo.hasActiveOwner();
    });
  } catch (err) {
    app.log.warn({ err }, 'status database lookup failed');
    throw app.httpErrors.serviceUnavailable('DATABASE_UNAVAILABLE');
  }
}

export async function registerStatusRoutes(app: FastifyInstance, deps?: StatusRouteDeps) {
  app.get(
    '/status',
    {
      schema: {
        summary: 'Public API identity and coarse setup state',
        description:
          'Unauthenticated contract for clients to validate a Healthy API base URL and decide onboarding vs login. Does not expose user counts.',
        response: {
          200: statusResponseSchema,
        },
      },
    },
    async () => {
      const hasOwner = await resolveHasActiveOwner(app, deps);
      return {
        api: {
          name: 'healthy-api' as const,
          version: getApiSemver(),
        },
        setupRequired: !hasOwner,
      };
    },
  );
}
