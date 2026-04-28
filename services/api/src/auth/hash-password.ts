import argon2 from 'argon2';

/**
 * One-way password hashing for storage. Uses Argon2id.
 */
export async function hashPasswordArgon2id(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPasswordArgon2id(plain: string, storedHash: string): Promise<boolean> {
  return argon2.verify(storedHash, plain);
}
