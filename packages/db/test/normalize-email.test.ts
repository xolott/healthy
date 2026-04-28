import { describe, expect, it } from 'vitest';

import { normalizeEmail } from '../src/users/normalize-email.js';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Foo@BAR.com \n')).toBe('foo@bar.com');
  });
});
