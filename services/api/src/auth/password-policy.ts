export const MIN_PASSWORD_LENGTH = 12;

export class PasswordPolicyError extends Error {
  readonly code = 'PASSWORD_POLICY' as const;
  constructor(
    message = 'Password does not meet policy',
    public readonly minLength: number = MIN_PASSWORD_LENGTH,
  ) {
    super(message);
    this.name = 'PasswordPolicyError';
  }
}

/**
 * Enforces a 12-character minimum password length (self-hosted baseline).
 */
export function assertPasswordMeetsPolicy(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordPolicyError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    );
  }
}
