import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { appendSessionCookie, getRequestIp } from '../auth/http-session.js';
import { ownerLoginFromAppRequest } from '../auth/auth-me-from-request.js';

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

/**
 * @public For tests: replace the default handler.
 */
export type OwnerLoginRouteOptions = {
  runLogin?: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

export async function registerOwnerLoginRoute(
  app: FastifyInstance,
  options?: OwnerLoginRouteOptions,
) {
  if (options?.runLogin !== undefined) {
    app.post('/auth/login', options.runLogin);
    return;
  }

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
          503: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      const secure = request.protocol === 'https';
      const ctx = {
        ip: getRequestIp(request),
        userAgent: (request.headers['user-agent'] ?? null) as string | null,
      };

      const result = await ownerLoginFromAppRequest(app, body.email, body.password, ctx);

      if (result.kind === 'service_unavailable') {
        return reply.status(503).send({ error: 'service_unavailable' });
      }

      if (result.kind === 'invalid_input') {
        return reply.status(400).send({
          error: 'invalid_input',
          field: result.field,
          message: result.message,
        });
      }

      if (result.kind === 'invalid_credentials') {
        return reply.status(401).send({ error: 'invalid_credentials' });
      }

      const maxAge = Math.max(
        60,
        Math.floor((result.sessionExpiresAt.getTime() - Date.now()) / 1000),
      );
      appendSessionCookie(reply, result.rawSessionToken, maxAge, secure);

      return reply.status(200).send({
        user: {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.displayName,
          role: result.user.role,
        },
        session: {
          token: result.rawSessionToken,
          expiresAt: result.sessionExpiresAt.toISOString(),
        },
      });
    },
  );
}
