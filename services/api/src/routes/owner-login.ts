import type { FastifyInstance, FastifyReply } from 'fastify';

import { appendSessionCookie, getRequestIp } from '../auth/http-session.js';
import type { PublicOwnerLoginOutcome } from '../request-scope/index.js';
import { createRequestScopeForApp, type RequestScope } from '../request-scope/index.js';

const postBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password'],
  properties: {
    email: { type: 'string' },
    password: { type: 'string' },
  },
} as const;

const postResponse200 = {
  type: 'object',
  additionalProperties: false,
  required: ['user', 'session'],
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
    session: {
      type: 'object',
      additionalProperties: false,
      required: ['token', 'expiresAt'],
      properties: {
        token: { type: 'string' },
        expiresAt: { type: 'string' },
      },
    },
  },
} as const;

const invalidInputResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['error', 'field', 'message'],
  properties: {
    error: { type: 'string', const: 'invalid_input' },
    field: { type: 'string', enum: ['email', 'password'] },
    message: { type: 'string' },
  },
} as const;

const invalidCredentialsResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string', const: 'invalid_credentials' },
  },
} as const;

const serviceUnavailableResponse = {
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

function sendOwnerLoginOutcome(
  reply: FastifyReply,
  outcome: PublicOwnerLoginOutcome,
  secureCookie: boolean,
) {
  switch (outcome.kind) {
    case 'persistence_not_configured':
    case 'persistence_unavailable':
      return reply.status(503).send({ error: 'service_unavailable' });
    case 'invalid_input':
      return reply.status(400).send({
        error: 'invalid_input',
        field: outcome.field,
        message: outcome.message,
      });
    case 'invalid_credentials':
      return reply.status(401).send({ error: 'invalid_credentials' });
    case 'success': {
      const maxAge = Math.max(
        60,
        Math.floor((outcome.sessionExpiresAt.getTime() - Date.now()) / 1000),
      );
      appendSessionCookie(reply, outcome.rawSessionToken, maxAge, secureCookie);
      return reply.status(200).send({
        user: {
          id: outcome.user.id,
          email: outcome.user.email,
          displayName: outcome.user.displayName,
          role: outcome.user.role,
        },
        session: {
          token: outcome.rawSessionToken,
          expiresAt: outcome.sessionExpiresAt.toISOString(),
        },
      });
    }
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

export async function registerOwnerLoginRoute(app: FastifyInstance, requestScope?: RequestScope) {
  const scope = resolveRequestScope(app, requestScope);

  app.post<{ Body: { email: string; password: string } }>(
    '/auth/login',
    {
      schema: {
        summary: 'Owner email/password login',
        description:
          'Authenticates an active owner. Sets an HttpOnly session cookie and returns a Bearer-capable opaque token for mobile. Failures are neutral (invalid_credentials).',
        body: postBodySchema,
        response: {
          200: postResponse200,
          400: invalidInputResponse,
          401: invalidCredentialsResponse,
          503: serviceUnavailableResponse,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      const secureCookie = request.protocol === 'https';
      const ctx = {
        ip: getRequestIp(request),
        userAgent: (request.headers['user-agent'] ?? null) as string | null,
      };

      const outcome = await scope.ownerLogin.loginWithEmailPassword(body.email, body.password, ctx);
      return sendOwnerLoginOutcome(reply, outcome, secureCookie);
    },
  );
}
