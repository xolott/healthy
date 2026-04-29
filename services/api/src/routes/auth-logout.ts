import type { FastifyInstance, FastifyReply } from 'fastify';

import { clearSessionCookie } from '../auth/http-session.js';
import { getSessionTokenFromRequest } from '../auth/parse-bearer-cookie.js';
import type { PublicLogoutOutcome } from '../request-scope/index.js';
import { createRequestScopeForApp, type RequestScope } from '../request-scope/index.js';

const authLogoutServiceUnavailableResponse = {
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

function sendLogoutOutcome(reply: FastifyReply, outcome: PublicLogoutOutcome) {
  switch (outcome.kind) {
    case 'persistence_not_configured':
    case 'persistence_unavailable':
      return reply.status(503).send({ error: 'service_unavailable' });
    case 'skipped':
    case 'session_revoked':
    case 'noop':
      return reply.status(204).send();
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

export async function registerAuthLogoutRoute(app: FastifyInstance, requestScope?: RequestScope) {
  const scope = resolveRequestScope(app, requestScope);

  app.post(
    '/auth/logout',
    {
      schema: {
        summary: 'Logout current session',
        description:
          'Revokes the session resolved from the Bearer token or HttpOnly cookie (same precedence as GET /auth/me). Clears the session cookie when the client used cookie transport.',
        response: { 204: { type: 'null' }, 503: authLogoutServiceUnavailableResponse },
      },
    },
    async (request, reply) => {
      const t = getSessionTokenFromRequest({
        authorization: request.headers.authorization,
        cookie: request.headers.cookie,
      });
      const outcome = await scope.logout.logoutWithRawToken(t.token);
      if (outcome.kind === 'persistence_not_configured' || outcome.kind === 'persistence_unavailable') {
        return sendLogoutOutcome(reply, outcome);
      }

      const secure = request.protocol === 'https';
      if (t.format === 'cookie') {
        clearSessionCookie(reply, secure);
      }

      return sendLogoutOutcome(reply, outcome);
    },
  );
}
