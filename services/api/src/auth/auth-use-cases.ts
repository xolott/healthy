import type { AuthPersistence } from './auth-persistence.js';
import { hashSessionTokenForLookup } from './session-token.js';

export type AuthMeUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
};

export type ResolveCurrentSessionUnauthorizedReason =
  | 'missing_session'
  | 'revoked'
  | 'expired'
  | 'user_missing'
  | 'user_ineligible';

/**
 * Closed result union for current-session resolution (no domain exceptions for expected outcomes).
 */
export type ResolveCurrentSessionResult =
  | { kind: 'ok'; user: AuthMeUser }
  | { kind: 'unauthorized'; reason: ResolveCurrentSessionUnauthorizedReason };

export type AuthUseCases = {
  resolveCurrentSession(rawToken: string): Promise<ResolveCurrentSessionResult>;
};

export type CreateAuthUseCasesInput = {
  persistence: AuthPersistence;
  clock: () => Date;
};

export function createAuthUseCases(deps: CreateAuthUseCasesInput): AuthUseCases {
  return {
    async resolveCurrentSession(rawToken: string): Promise<ResolveCurrentSessionResult> {
      const tokenHash = hashSessionTokenForLookup(rawToken);
      const now = deps.clock();

      const session = await deps.persistence.findSessionByTokenHash(tokenHash);
      if (session === undefined) {
        return { kind: 'unauthorized', reason: 'missing_session' };
      }
      if (session.revokedAt !== null) {
        return { kind: 'unauthorized', reason: 'revoked' };
      }
      if (session.expiresAt.getTime() <= now.getTime()) {
        return { kind: 'unauthorized', reason: 'expired' };
      }

      const user = await deps.persistence.findUserById(session.userId);
      if (user === undefined) {
        return { kind: 'unauthorized', reason: 'user_missing' };
      }
      if (user.status !== 'active' || user.deletedAt !== null) {
        return { kind: 'unauthorized', reason: 'user_ineligible' };
      }

      await deps.persistence.touchSessionLastUsedByTokenHash(tokenHash, now);

      return {
        kind: 'ok',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      };
    },
  };
}
