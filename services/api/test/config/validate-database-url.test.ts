import { describe, expect, it } from 'vitest';

import { assertValidOptionalDatabaseUrl } from '../../src/config/validate-database-url.js';

describe('assertValidOptionalDatabaseUrl', () => {
  it('accepts undefined', () => {
    expect(() => assertValidOptionalDatabaseUrl(undefined)).not.toThrow();
  });

  it('accepts empty or whitespace-only', () => {
    expect(() => assertValidOptionalDatabaseUrl('')).not.toThrow();
    expect(() => assertValidOptionalDatabaseUrl('   ')).not.toThrow();
  });

  it('accepts postgres and postgresql URLs', () => {
    expect(() => assertValidOptionalDatabaseUrl('postgres://localhost:5432/app')).not.toThrow();
    expect(() => assertValidOptionalDatabaseUrl('postgresql://user:pass@host/db')).not.toThrow();
  });

  it('rejects unparseable values', () => {
    expect(() => assertValidOptionalDatabaseUrl('not a url')).toThrow(/not a valid URL/);
  });

  it('rejects non-postgres schemes', () => {
    expect(() => assertValidOptionalDatabaseUrl('http://localhost:5432/db')).toThrow(/postgres/);
  });
});
