import type { FastifyInstance, FastifyReply } from 'fastify';

import { getSessionTokenFromRequest } from '../auth/parse-bearer-cookie.js';
import type { PublicCurrentSessionOutcome } from '../request-scope/index.js';
import { createRequestScopeForApp, type RequestScope } from '../request-scope/index.js';

const meResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['user'],
  properties: {
    user: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'email', 'displayName', 'role'],
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        displayName: { type: 'string' },
        role: { type: 'string', enum: ['owner', 'admin', 'member'] },
      },
    },
  },
} as const;

const authMeErrorResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string', enum: ['unauthorized'] },
  },
} as const;

const authMeServiceUnavailableResponse = {
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

function sendAuthMeOutcome(reply: FastifyReply, outcome: PublicCurrentSessionOutcome) {
  switch (outcome.kind) {
    case 'persistence_not_configured':
    case 'persistence_unavailable':
      return reply.status(503).send({ error: 'service_unavailable' });
    case 'ok':
      return reply.status(200).send({ user: outcome.user });
    case 'unauthorized':
      return reply.status(401).send({ error: 'unauthorized' });
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

export async function registerAuthMeRoute(app: FastifyInstance, requestScope?: RequestScope) {
  const scope = resolveRequestScope(app, requestScope);

  app.get(
    '/auth/me',
    {
      schema: {
        summary: 'Current session user',
        description: 'Resolves the active user from the Bearer token or the HttpOnly session cookie.',
        response: {
          200: meResponse,
          401: authMeErrorResponse,
          503: authMeServiceUnavailableResponse,
        },
      },
    },
    async (request, reply) => {
      const t = getSessionTokenFromRequest({
        authorization: request.headers.authorization,
        cookie: request.headers.cookie,
      });
      const rawToken = t.token;
      if (rawToken === undefined) {
        return reply.status(401).send({ error: 'unauthorized' });
      }

      const outcome = await scope.currentSession.resolveFromRawToken(rawToken);
      return sendAuthMeOutcome(reply, outcome);
    },
  );
}

export type { AuthMeUser } from '../auth/auth-use-cases.js';
