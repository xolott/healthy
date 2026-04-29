import type { FastifyInstance, FastifyReply } from 'fastify';

import { getApiSemver } from '../api-version.js';
import { createRequestScopeForApp, type RequestScope } from '../request-scope/index.js';

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

const statusServiceUnavailableResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string', enum: ['service_unavailable'] },
  },
} as const;

function resolveRequestScope(app: FastifyInstance, scope: RequestScope | undefined): RequestScope {
  return scope ?? createRequestScopeForApp(app);
}

function sendStatusPayload(reply: FastifyReply, hasOwner: boolean) {
  return reply.status(200).send({
    api: {
      name: 'healthy-api' as const,
      version: getApiSemver(),
    },
    setupRequired: !hasOwner,
  });
}

export async function registerStatusRoutes(app: FastifyInstance, requestScope?: RequestScope) {
  const scope = resolveRequestScope(app, requestScope);

  app.get(
    '/status',
    {
      schema: {
        summary: 'Public API identity and coarse setup state',
        description:
          'Unauthenticated contract for clients to validate a Healthy API base URL and decide onboarding vs login. Does not expose user counts.',
        response: {
          200: statusResponseSchema,
          503: statusServiceUnavailableResponse,
        },
      },
    },
    async (_request, reply) => {
      const outcome = await scope.status.activeOwnerExists();
      switch (outcome.kind) {
        case 'persistence_not_configured':
        case 'persistence_unavailable':
          return reply.status(503).send({ error: 'service_unavailable' });
        case 'ok':
          return sendStatusPayload(reply, outcome.hasActiveOwner);
        default: {
          const _exhaustive: never = outcome;
          return _exhaustive;
        }
      }
    },
  );
}
