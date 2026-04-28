import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { withDisposableDatabase } from '@healthy/db';

import { getSessionTokenFromRequest } from '../auth/parse-bearer-cookie.js';
import { resolveAuthMeUser, type AuthMeUser } from '../auth/resolve-auth-me.js';

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
        response: { 200: meResponse, 401: { type: 'object' }, 503: { type: 'object' } },
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

      const url = app.config.DATABASE_URL?.trim();
      if (url === undefined || url === '') {
        return reply.status(503).send({ error: 'service_unavailable' });
      }

      const u = await withDisposableDatabase(url, (db) => resolveAuthMeUser(db, rawToken));
      if (u === 'unauthorized') {
        return reply.status(401).send({ error: 'unauthorized' });
      }
      return reply.status(200).send({ user: u });
    },
  );
}

export type { AuthMeUser };
