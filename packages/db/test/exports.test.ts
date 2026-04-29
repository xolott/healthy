import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createDatabaseAdapter, createDb, withDisposableDatabase } from '../src/index.js';

const pkgDir = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(pkgDir, '../package.json'), 'utf8')) as {
  exports: Record<string, unknown>;
};

describe('@healthy/db exports', () => {
  it('exposes createDb for consumers', () => {
    expect(typeof createDb).toBe('function');
  });

  it('exposes createDatabaseAdapter for consumers', () => {
    expect(typeof createDatabaseAdapter).toBe('function');
  });

  it('exposes withDisposableDatabase for consumers', () => {
    expect(typeof withDisposableDatabase).toBe('function');
  });

  it('does not export repository factories or setup-status persistence from the public index', async () => {
    const mod = await import('../src/index.js');
    expect(mod).not.toHaveProperty('createUserRepository');
    expect(mod).not.toHaveProperty('createSessionRepository');
    expect(mod).not.toHaveProperty('createSetupStatusPersistence');
  });

  it('does not expose repository modules or email helpers as public package subpaths', () => {
    expect(packageJson.exports).not.toHaveProperty('./users');
    expect(packageJson.exports).not.toHaveProperty('./sessions');
    expect(packageJson.exports).not.toHaveProperty('./audit-logs');
  });
});
