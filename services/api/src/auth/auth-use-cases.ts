import type { AuthPersistence, AuthUserForOwnerLogin } from './auth-persistence.js';
import { assertPasswordMeetsPolicy, PasswordPolicyError } from './password-policy.js';
import { hashSessionTokenForLookup } from './session-token.js';

const SESSION_DAYS = 30;

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

export type OwnerLoginInvalidInputField = 'email' | 'password';

/**
 * Closed result union for owner email/password login.
 */
export type OwnerLoginResult =
  | { kind: 'invalid_input'; field: OwnerLoginInvalidInputField; message: string }
  | { kind: 'invalid_credentials' }
  | {
      kind: 'success';
      user: AuthMeUser;
      rawSessionToken: string;
      sessionExpiresAt: Date;
    };

export type AuthUseCases = {
  resolveCurrentSession(rawToken: string): Promise<ResolveCurrentSessionResult>;
  ownerLogin(
    rawEmail: string,
    rawPassword: string,
    ctx: { ip: string | null; userAgent: string | null },
  ): Promise<OwnerLoginResult>;
};

export type CreateAuthUseCasesInput = {
  persistence: AuthPersistence;
  clock: () => Date;
  verifyPassword: (plain: string, storedHash: string) => Promise<boolean>;
  generateSessionToken: () => { rawToken: string; tokenHash: string };
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

    async ownerLogin(
      rawEmail: string,
      rawPassword: string,
      ctx: { ip: string | null; userAgent: string | null },
    ): Promise<OwnerLoginResult> {
      const email = rawEmail.trim();
      if (email.length === 0) {
        return { kind: 'invalid_input', field: 'email', message: 'Email is required' };
      }
      if (!email.includes('@')) {
        return { kind: 'invalid_input', field: 'email', message: 'Email is invalid' };
      }

      try {
        assertPasswordMeetsPolicy(rawPassword);
      } catch (e) {
        if (e instanceof PasswordPolicyError) {
          return { kind: 'invalid_input', field: 'password', message: e.message };
        }
        throw e;
      }

      return deps.persistence.withTransaction(async (p) => {
        const user = await p.findUserForOwnerLoginByEmail(email);
        if (!isOwnerLoginEligible(user)) {
          return { kind: 'invalid_credentials' };
        }

        const passwordOk = await deps.verifyPassword(rawPassword, user.passwordHash);
        if (!passwordOk) {
          return { kind: 'invalid_credentials' };
        }

        const { rawToken, tokenHash } = deps.generateSessionToken();
        const now = deps.clock();
        const sessionExpiresAt = new Date(
          now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000,
        );

        await p.createOwnerLoginSession({
          userId: user.id,
          tokenHash,
          expiresAt: sessionExpiresAt,
          lastUsedAt: now,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
        });

        await p.setOwnerLastLoginAt(user.id, now);

        return {
          kind: 'success',
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
          },
          rawSessionToken: rawToken,
          sessionExpiresAt,
        };
      });
    },
  };
}

function isOwnerLoginEligible(
  user: AuthUserForOwnerLogin | undefined,
): user is AuthUserForOwnerLogin {
  if (user === undefined) {
    return false;
  }
  return user.role === 'owner' && user.status === 'active' && user.deletedAt === null;
}
