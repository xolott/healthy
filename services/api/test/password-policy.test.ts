import { describe, expect, it } from 'vitest';

import { assertPasswordMeetsPolicy, MIN_PASSWORD_LENGTH, PasswordPolicyError } from '../src/auth/password-policy.js';

describe('assertPasswordMeetsPolicy', () => {
  it('accepts a password of at least 12 characters', () => {
    expect(() => assertPasswordMeetsPolicy('a'.repeat(12))).not.toThrow();
  });

  it('rejects when shorter than 12', () => {
    expect(() => assertPasswordMeetsPolicy('a'.repeat(11))).toThrow(PasswordPolicyError);
  });
});

describe('MIN_PASSWORD_LENGTH', () => {
  it('is 12', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });
});