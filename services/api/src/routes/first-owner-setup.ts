import type { FastifyInstance, FastifyReply } from 'fastify';

import { appendSessionCookie, getRequestIp } from '../auth/http-session.js';
import type { PublicFirstOwnerSetupOutcome } from '../request-scope/index.js';
import { createRequestScopeForApp, type RequestScope } from '../request-scope/index.js';

const postBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['displayName', 'email', 'password'],
  properties: {
    displayName: { type: 'string' },
    email: { type: 'string' },
    password: { type: 'string' },
  },
} as const;

const postResponse201 = {
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

function sendFirstOwnerSetupOutcome(
  reply: FastifyReply,
  outcome: PublicFirstOwnerSetupOutcome,
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
    case 'password_policy':
      return reply.status(400).send({
        error: 'password_policy',
        minLength: outcome.minLength,
        message: outcome.message,
      });
    case 'setup_unavailable':
      return reply.status(404).send({ error: 'not_found' });
    case 'success': {
      const maxAge = Math.max(
        60,
        Math.floor((outcome.sessionExpiresAt.getTime() - Date.now()) / 1000),
      );
      appendSessionCookie(reply, outcome.rawSessionToken, maxAge, secureCookie);
      return reply.status(201).send({
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

export async function registerFirstOwnerSetupRoute(app: FastifyInstance, requestScope?: RequestScope) {
  const scope = resolveRequestScope(app, requestScope);

  app.post<{ Body: { displayName: string; email: string; password: string } }>(
    '/setup/first-owner',
    {
      schema: {
        summary: 'Create first owner (setup only)',
        description:
          'When no active owner exists, create the initial owner, issue a 30-day session, and return the opaque token for mobile Bearer transport. Browsers also receive an HttpOnly cookie. After setup, this path responds with a neutral not-found when setup is not available.',
        body: postBodySchema,
        response: { 201: postResponse201, 503: serviceUnavailableResponse },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const secure = request.protocol === 'https';
      const ctx = {
        setCookie: true,
        ip: getRequestIp(request),
        userAgent: (request.headers['user-agent'] ?? null) as string | null,
      };

      const outcome = await scope.firstOwnerSetup.setupFirstOwner(
        body.displayName,
        body.email,
        body.password,
        ctx,
      );
      return sendFirstOwnerSetupOutcome(reply, outcome, secure);
    },
  );
}
