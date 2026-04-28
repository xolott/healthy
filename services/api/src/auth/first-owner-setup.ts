import {
  createSessionRepository,
  createUserRepository,
  FirstOwnerAlreadyExistsError,
} from '@healthy/db';
import type { UserRow } from '@healthy/db/schema';
import type { Database } from '@healthy/db';

import { hashPasswordArgon2id } from './hash-password.js';
import { assertPasswordMeetsPolicy, MIN_PASSWORD_LENGTH, PasswordPolicyError } from './password-policy.js';
import { generateSessionToken } from './session-token.js';

const DISPLAY_NAME_MAX = 200;
const SETUP_NOT_AVAILABLE = 'not_available' as const;

export class SetupInputError extends Error {
  readonly code = 'SETUP_INPUT' as const;
  constructor(
    message: string,
    public readonly field: 'displayName' | 'email' | 'password',
  ) {
    super(message);
    this.name = 'SetupInputError';
  }
}

export type FirstOwnerInput = {
  displayName: string;
  email: string;
  password: string;
};

export type FirstOwnerSuccess = {
  kind: 'success';
  user: Pick<UserRow, 'id' | 'email' | 'displayName' | 'role'>;
  rawSessionToken: string;
  sessionExpiresAt: Date;
  setCookie: boolean;
};

export type FirstOwnerResult =
  | FirstOwnerSuccess
  | { kind: typeof SETUP_NOT_AVAILABLE }
  | { kind: 'password_policy'; message: string; minLength: number };
const SESSION_DAYS = 30;

/**
 * Trims and validates shape; may throw `SetupInputError` or `PasswordPolicyError` for bad password.
 */
function trimAndValidateInput(input: FirstOwnerInput): {
  displayName: string;
  email: string;
  password: string;
} {
  const displayName = input.displayName.trim();
  const email = input.email.trim();
  if (displayName.length === 0) {
    throw new SetupInputError('Display name is required', 'displayName');
  }
  if (displayName.length > DISPLAY_NAME_MAX) {
    throw new SetupInputError('Display name is too long', 'displayName');
  }
  if (email.length === 0) {
    throw new SetupInputError('Email is required', 'email');
  }
  if (!email.includes('@')) {
    throw new SetupInputError('Email is invalid', 'email');
  }
  assertPasswordMeetsPolicy(input.password);
  return { displayName, email, password: input.password };
}

/**
 * Creates the first owner and a 30-day session, or returns when setup is no longer available.
 * Run inside a transaction.
 */
export async function runFirstOwnerSetupInDb(
  db: Database,
  input: FirstOwnerInput,
  ctx: { setCookie: boolean; ip: string | null; userAgent: string | null },
): Promise<FirstOwnerResult> {
  let body: { displayName: string; email: string; password: string };
  try {
    body = trimAndValidateInput(input);
  } catch (err) {
    if (err instanceof SetupInputError) {
      throw err;
    }
    if (err instanceof PasswordPolicyError) {
      return { kind: 'password_policy', message: err.message, minLength: err.minLength };
    }
    throw err;
  }

  const userRepo = createUserRepository(db);
  const sessionRepo = createSessionRepository(db);

  if (await userRepo.hasActiveOwner()) {
    return { kind: SETUP_NOT_AVAILABLE };
  }

  const passwordHash = await hashPasswordArgon2id(body.password);

  let user: UserRow;
  try {
    user = await userRepo.createFirstOwner({
      email: body.email,
      displayName: body.displayName,
      passwordHash,
    });
  } catch (err) {
    if (err instanceof FirstOwnerAlreadyExistsError) {
      return { kind: SETUP_NOT_AVAILABLE };
    }
    throw err;
  }

  const { rawToken, tokenHash } = generateSessionToken();
  const now = new Date();
  const sessionExpiresAt = new Date(
    now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  );

  await sessionRepo.createSession({
    userId: user.id,
    tokenHash,
    expiresAt: sessionExpiresAt,
    lastUsedAt: now,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  await userRepo.setLastLoginAt(user.id, now);

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
}

export { MIN_PASSWORD_LENGTH };
