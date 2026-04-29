import { FirstOwnerAlreadyExistsError } from '@healthy/db';

import type { AuthPersistence, AuthUserForOwnerLogin } from './auth-persistence.js';
import { assertPasswordMeetsPolicy, PasswordPolicyError } from './password-policy.js';
import { hashSessionTokenForLookup } from './session-token.js';

const SESSION_DAYS = 30;
const DISPLAY_NAME_MAX = 200;

export type FirstOwnerSetupInvalidField = 'displayName' | 'email' | 'password';

/**
 * Payload after trim + shape/policy checks; used before persistence (e.g. missing DATABASE_URL).
 */
export type FirstOwnerSetupValidated =
  | { kind: 'invalid_input'; field: FirstOwnerSetupInvalidField; message: string }
  | { kind: 'password_policy'; message: string; minLength: number }
  | { kind: 'ok'; displayName: string; email: string; password: string };

export function validateFirstOwnerSetupPayload(
  rawDisplayName: string,
  rawEmail: string,
  rawPassword: string,
): FirstOwnerSetupValidated {
  const displayName = rawDisplayName.trim();
  if (displayName.length === 0) {
    return { kind: 'invalid_input', field: 'displayName', message: 'Display name is required' };
  }
  if (displayName.length > DISPLAY_NAME_MAX) {
    return { kind: 'invalid_input', field: 'displayName', message: 'Display name is too long' };
  }

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
      return { kind: 'password_policy', message: e.message, minLength: e.minLength };
    }
    throw e;
  }

  return { kind: 'ok', displayName, email, password: rawPassword };
}

/**
 * Closed result union for first-owner bootstrap setup.
 */
export type FirstOwnerSetupResult =
  | { kind: 'invalid_input'; field: FirstOwnerSetupInvalidField; message: string }
  | { kind: 'password_policy'; message: string; minLength: number }
  | { kind: 'setup_unavailable' }
  | {
      kind: 'success';
      user: AuthMeUser;
      rawSessionToken: string;
      sessionExpiresAt: Date;
      setCookie: boolean;
    };

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

/**
 * Closed result union for logout (session revocation); HTTP mapping stays in routes.
 */
export type LogoutResult =
  | { kind: 'skipped'; reason: 'no_raw_token' }
  | { kind: 'session_revoked' }
  | { kind: 'noop'; reason: 'session_not_found_or_already_revoked' };

export type AuthUseCases = {
  resolveCurrentSession(rawToken: string): Promise<ResolveCurrentSessionResult>;
  logout(rawToken: string | undefined): Promise<LogoutResult>;
  ownerLogin(
    rawEmail: string,
    rawPassword: string,
    ctx: { ip: string | null; userAgent: string | null },
  ): Promise<OwnerLoginResult>;
  firstOwnerSetup(
    rawDisplayName: string,
    rawEmail: string,
    rawPassword: string,
    ctx: { setCookie: boolean; ip: string | null; userAgent: string | null },
  ): Promise<FirstOwnerSetupResult>;
};

export type CreateAuthUseCasesInput = {
  persistence: AuthPersistence;
  clock: () => Date;
  verifyPassword: (plain: string, storedHash: string) => Promise<boolean>;
  generateSessionToken: () => { rawToken: string; tokenHash: string };
  hashPassword: (plain: string) => Promise<string>;
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

    async logout(rawToken: string | undefined): Promise<LogoutResult> {
      if (rawToken === undefined || rawToken.length === 0) {
        return { kind: 'skipped', reason: 'no_raw_token' };
      }

      const tokenHash = hashSessionTokenForLookup(rawToken);
      const now = deps.clock();
      const { revoked } = await deps.persistence.revokeSessionByTokenHash(tokenHash, now);
      if (revoked) {
        return { kind: 'session_revoked' };
      }
      return { kind: 'noop', reason: 'session_not_found_or_already_revoked' };
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

    async firstOwnerSetup(
      rawDisplayName: string,
      rawEmail: string,
      rawPassword: string,
      ctx: { setCookie: boolean; ip: string | null; userAgent: string | null },
    ): Promise<FirstOwnerSetupResult> {
      const validated = validateFirstOwnerSetupPayload(rawDisplayName, rawEmail, rawPassword);
      if (validated.kind === 'invalid_input') {
        return validated;
      }
      if (validated.kind === 'password_policy') {
        return validated;
      }

      return deps.persistence.withTransaction(async (p) => {
        if (await p.hasActiveOwner()) {
          return { kind: 'setup_unavailable' };
        }

        const passwordHash = await deps.hashPassword(validated.password);

        let user;
        try {
          user = await p.createFirstOwnerUser({
            email: validated.email,
            displayName: validated.displayName,
            passwordHash,
          });
        } catch (e) {
          if (e instanceof FirstOwnerAlreadyExistsError) {
            return { kind: 'setup_unavailable' };
          }
          throw e;
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
          setCookie: ctx.setCookie,
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
