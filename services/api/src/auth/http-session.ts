import type { FastifyReply, FastifyRequest } from 'fastify';

import { SESSION_COOKIE_NAME } from './session-token.js';

export function appendSessionCookie(
  reply: FastifyReply,
  rawToken: string,
  maxAgeSec: number,
  secure: boolean,
) {
  const sameSite = secure ? 'None' : 'Lax';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${String(maxAgeSec)}`,
    `SameSite=${sameSite}`,
  ];
  if (secure) {
    parts.push('Secure');
  }
  reply.header('Set-Cookie', parts.join('; '));
}

export function getRequestIp(request: FastifyRequest): string | null {
  const h = request.headers['x-forwarded-for'];
  if (typeof h === 'string' && h.length > 0) {
    return h.split(',')[0]?.trim() ?? null;
  }
  return request.ip;
}
