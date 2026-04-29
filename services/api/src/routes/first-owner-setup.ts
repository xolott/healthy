import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { appendSessionCookie, getRequestIp } from '../auth/http-session.js';
import { firstOwnerSetupFromAppRequest } from '../auth/auth-use-case-scope.js';

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

/**
 * @public For tests: replace the default handler.
 */
export type FirstOwnerRouteOptions = {
  runSetup?: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

export async function registerFirstOwnerSetupRoute(
  app: FastifyInstance,
  options?: FirstOwnerRouteOptions,
) {
  if (options?.runSetup !== undefined) {
    app.post('/setup/first-owner', options.runSetup);
    return;
  }

  app.post<{ Body: { displayName: string; email: string; password: string } }>(
    '/setup/first-owner',
    {
      schema: {
        summary: 'Create first owner (setup only)',
        description:
          'When no active owner exists, create the initial owner, issue a 30-day session, and return the opaque token for mobile Bearer transport. Browsers also receive an HttpOnly cookie. After setup, this path responds with a neutral not-found when setup is not available.',
        body: postBodySchema,
        response: { 201: postResponse201 },
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

      const result = await firstOwnerSetupFromAppRequest(
        app,
        body.displayName,
        body.email,
        body.password,
        ctx,
      );

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
      if (result.kind === 'password_policy') {
        return reply.status(400).send({
          error: 'password_policy',
          minLength: result.minLength,
          message: result.message,
        });
      }
      if (result.kind === 'setup_unavailable') {
        return reply.status(404).send({ error: 'not_found' });
      }

      const maxAge = Math.max(
        60,
        Math.floor((result.sessionExpiresAt.getTime() - Date.now()) / 1000),
      );
      appendSessionCookie(reply, result.rawSessionToken, maxAge, secure);

      return reply.status(201).send({
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
