import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { getSessionTokenFromRequest } from '../auth/parse-bearer-cookie.js';
import {
  resolveAuthMeFromAppRequest,
  type AuthMeFromAppRequestOutcome,
  type AuthMeUser,
} from '../auth/auth-use-case-scope.js';

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

function sendAuthMeOutcome(reply: FastifyReply, outcome: AuthMeFromAppRequestOutcome) {
  switch (outcome.kind) {
    case 'service_unavailable':
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

/**
 * @public For tests: replace the default current-user resolution.
 */
export type AuthMeRouteOptions = {
  getUser?: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

export async function registerAuthMeRoute(app: FastifyInstance, options?: AuthMeRouteOptions) {
  if (options?.getUser !== undefined) {
    app.get('/auth/me', options.getUser);
    return;
  }

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

      const outcome = await resolveAuthMeFromAppRequest(app, rawToken);
      return sendAuthMeOutcome(reply, outcome);
    },
  );
}

export type { AuthMeUser };
