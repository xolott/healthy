import { SESSION_COOKIE_NAME } from './session-token.js';

function parseCookieHeader(value: string | undefined, name: string): string | undefined {
  if (value === undefined || value === '') {
    return;
  }
  for (const part of value.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1).trim());
    }
  }
  return;
}

/**
 * Opaque session token from `Authorization: Bearer` or the HttpOnly API cookie.
 */
export function getSessionTokenFromRequest(headers: { authorization?: string; cookie?: string }): {
  format: 'bearer' | 'cookie' | 'none';
  token?: string;
} {
  const auth = headers.authorization?.trim();
  if (auth !== undefined && auth.length > 0) {
    const m = auth.match(/^Bearer\s+(\S+)$/i);
    if (m !== null && m[1] !== undefined) {
      return { format: 'bearer', token: m[1] };
    }
  }
  const c = parseCookieHeader(headers.cookie, SESSION_COOKIE_NAME);
  if (c !== undefined && c.length > 0) {
    return { format: 'cookie', token: c };
  }
  return { format: 'none' };
}
