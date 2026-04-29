import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { clearSessionCookie } from '../auth/http-session.js';
import { logoutFromAppRequest } from '../auth/auth-me-from-request.js';
import { getSessionTokenFromRequest } from '../auth/parse-bearer-cookie.js';

/**
 * @public For tests: replace the default handler.
 */
export type AuthLogoutRouteOptions = {
  logout?: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

export async function registerAuthLogoutRoute(app: FastifyInstance, options?: AuthLogoutRouteOptions) {
  if (options?.logout !== undefined) {
    app.post('/auth/logout', options.logout);
    return;
  }

  app.post(
    '/auth/logout',
    {
      schema: {
        summary: 'Logout current session',
        description:
          'Revokes the session resolved from the Bearer token or HttpOnly cookie (same precedence as GET /auth/me). Clears the session cookie when the client used cookie transport.',
        response: { 204: { type: 'null' }, 503: { type: 'object' } },
      },
    },
    async (request, reply) => {
      const t = getSessionTokenFromRequest({
        authorization: request.headers.authorization,
        cookie: request.headers.cookie,
      });
      const outcome = await logoutFromAppRequest(app, t.token);
      if (outcome.kind === 'service_unavailable') {
        return reply.status(503).send({ error: 'service_unavailable' });
      }

      const secure = request.protocol === 'https';
      if (t.format === 'cookie') {
        clearSessionCookie(reply, secure);
      }

      return reply.status(204).send();
    },
  );
}
